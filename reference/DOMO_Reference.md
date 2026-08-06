# Product Sales History — Query Reference

**Source:** ComputerEase ERP, surfaced through Domo.
**Scope:** Schema and query rules only.

This file is **not** a freshness indicator and contains no live figures. Never state
or imply a "last refreshed" date from this document. Determine the data boundary by
querying it.

Replaces `DOMO_Schema2.md` and `DOMO_Quick_Reference_CORRECTED.md`. Do not use those.

---

## 1. Query mechanics

Four rules, no exceptions.

1. **The table is always `table`.** This is Domo's alias convention for the queried
   dataset, not a placeholder. There is no other table name.
2. **Double-quote any column containing a space or slash.** Canonical list in section 6.
3. **Extended price and extended cost are not stored columns.** Compute them:
   `price * qty` for line revenue, `cost * qty` for line cost. A query referencing
   `"Ext Price"` as a column will fail.
4. **Bound every row-level query.** Aggregates return one row and need no limit.
   Row-level pulls need a `LIMIT`, and if the result is capped the query errors rather
   than truncating, so a capped result is never silently wrong.

### Date handling

Prefer explicit range comparisons. They are unambiguous and dialect independent:

```sql
WHERE invdate >= '2025-01-01' AND invdate < '2026-01-01'
```

For month grouping use `substr`, which is safe across SQL dialects:

```sql
substr(invdate, 1, 7) AS month     -- yields 'YYYY-MM'
```

Do not use `strftime`. It is SQLite syntax and was carried into the previous reference
by mistake. Domo's dialect has not been confirmed to support it.

Dates are stored as `YYYY-MM-DD`, so string comparison and `substr` both behave
correctly on them.

---

## 2. Establishing the data boundary

Mandatory before answering anything time-relative: YTD, this month, latest, so far,
current, how are we doing.

Call the `data_boundary` tool. If unavailable, query directly:

```sql
SELECT MAX(invdate) AS latest_invdate, MIN(invdate) AS earliest_invdate
FROM table
LIMIT 1
```

Do not add a year filter to this query. Filtering to `>= '2026-01-01'` returns null
the moment a new year has no invoiced rows yet.

Then:

- Use the returned date as the upper bound on every subsequent query.
- Open the answer with "As of {latest_invdate}".
- If any later query returns a row with an invoice date beyond that boundary, the
  transaction wins. Acknowledge the correction and re-anchor to the later date.

The dataset reflects the last dataflow run, not live ERP state. Do not describe
figures as real time.

---

## 3. The three revenue modes

The most common source of wrong answers. Delivery is a separate line item on the order,
so the `class` filter changes what is being measured. Pick the mode deliberately and say
which one was used whenever the answer could be read either way.

| Mode | Filter | Use when |
|---|---|---|
| **Product revenue** | `class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')` | Default for revenue, sales, margin, customer, rep, region, or segment questions |
| **Freight** | `class IN ('DEL-LAND','DEL-SPOR','DELIVERY')` | Delivery cost, freight recovery, carrier or lane analysis |
| **Total billed** | no class filter | Only when explicitly asked to include delivery, or reconciling to an invoice total |

Freight is the **inverse** filter, not a variation on the default. Applying the product
filter to a freight question returns a plausible number built from the wrong population.

### The complete class list

Fifteen values, verified against the data. Do not work from a remembered subset.

**Product classes**, all included in product revenue:

`ENVIRO`, `SAFSHELL`, `HOMEDEP`, `SMOOTHPL`, `EMERALD`, `PROPLAY`, `RAWSAND`,
`ALVEOPAD`, `PARTIAL`, `HTPALLET`, `DISCOUNT`, and the empty string `''`.

**Delivery classes**, all excluded from product revenue and the sole population for
freight:

`DEL-LAND`, `DEL-SPOR`, `DELIVERY`.

### Four classes that need explanation

**`DELIVERY`** is a freight credit class. Every row in it has a negative price, so it is
where delivery charges get reversed, not a third source of freight revenue. It must be
in the freight filter or net freight is overstated. A two-value exclusion of only
`DEL-LAND` and `DEL-SPOR` is wrong and was the state of this dataset's documentation for
a year.

**`DISCOUNT`** belongs in product revenue and is not an error. Discount lines are
predominantly negative and reduce net revenue, which is the correct treatment. Including
them yields net; excluding them would yield gross. Net is the default. Do not "fix" this.

**`HTPALLET`** is a flat $18 per pallet handling pass-through. Every row is priced at
exactly $18. Economically closer to freight than product, but immaterial at roughly
0.02% of revenue, so it stays in product rather than justifying a filter branch. Mention
it only if a freight question turns on pallet fees specifically.

**`''`**, the empty string, is a real stored value and not a null. `WHERE class = ''`
matches, which means `NOT IN` includes these rows and they currently count as product
revenue. That is the right default, since they are real transactions with real dollars.
But note the shape: high line count, low value, prices spanning negative to positive.
They behave like miscellaneous adjustments. They are roughly 3% of all line items and
well under 0.1% of revenue, so they matter for any count based metric and barely at all
for dollar totals. Report them as uncategorized rather than dropping them.

### Negative prices are everywhere, not just in DISCOUNT

`MIN(price)` is negative in `ENVIRO`, `DEL-LAND`, `PARTIAL`, `''`, `DELIVERY`, and
`DISCOUNT`. Returns and credits are booked in class, not segregated. Consequences:

- `SUM(price * qty)` is correct and nets credits against charges. This is what you want.
- `AVG(price)`, `MIN(price)`, and `MAX(price)` are close to meaningless across
  unsegmented rows.
- A customer or period can legitimately show negative revenue in a narrow slice.
  Report it rather than assuming a query error.

---

## 4. Core calculations

```sql
-- Product revenue
SUM(price * qty)
WHERE class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')

-- Product cost
SUM(cost * qty)
WHERE class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')

-- Gross profit
SUM((price * qty) - (cost * qty))

-- Margin percent, always from totals, never averaged from line margins
(SUM((price * qty) - (cost * qty)) / SUM(price * qty)) * 100

-- Orders vs line items
COUNT(DISTINCT quotenum)   -- orders
COUNT(*)                   -- line items

-- Average order value
SUM(price * qty) / COUNT(DISTINCT quotenum)
```

### Freight metrics

On `DEL-LAND` and `DEL-SPOR` rows, `price * qty` is what the customer was billed for
delivery and `cost * qty` is what the carrier billed. The difference is freight
recovery.

```sql
-- Freight recovery, positive means delivery is billed above carrier cost
SUM(price * qty) - SUM(cost * qty)
WHERE class IN ('DEL-LAND','DEL-SPOR','DELIVERY')

-- Recovery rate
(SUM(price * qty) / SUM(cost * qty)) * 100
WHERE class IN ('DEL-LAND','DEL-SPOR','DELIVERY')
```

Delivery lines appear to carry `qty = 1` with the full charge in `price`. Observed
directly on a `DEL-SPOR` row and consistent with `DEL-LAND` averaging about $1,820 per
line. Not yet confirmed across all three delivery classes, so verify before relying on
`COUNT(*)` as a delivery count.

Freight per pound requires joining product weight to the delivery line via the shared
`quotenum`, since the `DEL-*` rows carry the charge and the product rows carry the
weight. Verify this relationship against real orders before relying on it.

---

## 5. Query patterns

Every example below carries an explicit class filter. Copy the filter, not just the
shape.

### Product revenue for a period

```sql
SELECT SUM(price * qty) AS revenue
FROM table
WHERE invdate >= '2025-01-01' AND invdate < '2026-01-01'
  AND class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')
LIMIT 1
```

### Monthly trend

```sql
SELECT substr(invdate,1,7) AS month,
       SUM(price * qty) AS revenue,
       COUNT(DISTINCT quotenum) AS orders
FROM table
WHERE invdate >= '2025-01-01'
  AND class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')
GROUP BY substr(invdate,1,7)
ORDER BY month
LIMIT 60
```

### Top customers

```sql
SELECT cusname,
       SUM(price * qty) AS revenue,
       SUM((price * qty) - (cost * qty)) AS profit,
       COUNT(DISTINCT quotenum) AS orders
FROM table
WHERE class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')
GROUP BY cusname
ORDER BY revenue DESC
LIMIT 25
```

### Rep performance

```sql
SELECT repnum,
       SUM(price * qty) AS revenue,
       SUM((price * qty) - (cost * qty)) AS profit,
       COUNT(DISTINCT quotenum) AS orders
FROM table
WHERE invdate >= '2025-01-01'
  AND class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')
GROUP BY repnum
ORDER BY revenue DESC
LIMIT 25
```

### Region or segment split

```sql
SELECT "Sales Region",
       SUM(price * qty) AS revenue
FROM table
WHERE class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')
GROUP BY "Sales Region"
ORDER BY revenue DESC
LIMIT 25
```

Do not filter out nulls to tidy the output. If `"Sales Region"` is null on revenue
bearing rows, that revenue is real and must appear, labeled as unassigned. Silently
dropping it makes the parts fail to sum to the whole.

### Account drill-down

```sql
SELECT quotenum, invdate, itemnum, des, class, qty, price,
       price * qty AS line_revenue,
       cost * qty AS line_cost,
       "Customer PO", Project
FROM table
WHERE cusname = 'XGrass'
  AND invdate >= '2025-01-01' AND invdate < '2026-01-01'
ORDER BY invdate, quotenum
LIMIT 500
```

No class filter here on purpose. An account history should show the delivery lines,
because that is what the invoice shows. If the pull hits the row cap, narrow the date
range rather than accepting a partial history.

### Freight by carrier

```sql
SELECT "Freight Company",
       "Freight Type",
       SUM(price * qty) AS freight_billed,
       SUM(cost * qty) AS freight_cost,
       SUM(price * qty) - SUM(cost * qty) AS recovery,
       COUNT(DISTINCT quotenum) AS orders
FROM table
WHERE class IN ('DEL-LAND','DEL-SPOR','DELIVERY')
  AND invdate >= '2025-01-01'
GROUP BY "Freight Company", "Freight Type"
ORDER BY freight_cost DESC
LIMIT 100
```

---

## 6. Columns requiring double quotes

```
"Customer PO"        "Delivery City"      "Delivery State"
"Freight Company"    "Freight Owner"      "Freight Type"
"Landscape/Sports"   "Logistics Company"  "Ops Owner"
"Other Info"         "Parent Company"     "Pounds per Unit"
"Production Site"    "Sales Region"       "SKU Group"
"Unit Of Measure"    "Zip Code"
```

Everything else is unquoted: `quotenum`, `cusname`, `date`, `invdate`, `qty`, `price`,
`cost`, `repnum`, `itemnum`, `des`, `class`, `name`, `itemloc`, `salesacct`, `Tier`,
`Customer_User`, `Project`, `FFItem_Itemnum`.

---

## 7. Column dictionary

### Order and transaction

| Column | Type | Notes |
|---|---|---|
| `quotenum` | text | Quote / order number. Use for distinct order counts. Multiple rows share one value. |
| `date` | date | Order date. Use for order timing questions. |
| `invdate` | date | Invoice date. Use for revenue recognition and all period reporting. |
| `"Customer PO"` | text | Customer purchase order number. |
| `Project` | text | Project or job name. |
| `"Other Info"` | text | Free-form order notes. |

### Money and quantity

| Column | Type | Notes |
|---|---|---|
| `qty` | decimal | Can be fractional. Units vary by item, see section 8. |
| `price` | decimal | Unit price. |
| `cost` | decimal | Unit cost. |
| `salesacct` | decimal | GL sales account. |
| `Tier` | integer | Pricing tier, 1 through 5. |

### Customer

| Column | Type | Notes |
|---|---|---|
| `cusname` | text | Customer company name. Primary customer identifier. |
| `"Parent Company"` | text | Parent org grouping. Use when rolling up related accounts. |
| `Customer_User` | text | Customer type flag, typically Yes / No. |
| `"Delivery City"` | text | Ship-to city. |
| `"Delivery State"` | text | Ship-to state or province. |
| `"Zip Code"` | text | Ship-to postal code. |

### Sales organization

| Column | Type | Notes |
|---|---|---|
| `repnum` | text | Sales rep code. Known values include SG, BEN B, BB, BS, CS, AC. |
| `"Sales Region"` | text | Known values include Nat Acct, West, East, Retail, Canada, International. |
| `"Ops Owner"` | text | Operations owner initials. |

### Product

| Column | Type | Notes |
|---|---|---|
| `itemnum` | text | SKU / product code. |
| `FFItem_Itemnum` | text | Duplicate of `itemnum`. Do not use. Verify equality before relying on that assumption. |
| `des` | text | Item description. |
| `class` | text | Product or delivery classification. See section 3. |
| `"SKU Group"` | text | Product family grouping. |
| `"Landscape/Sports"` | text | Market segment. |
| `"Unit Of Measure"` | text | lb, ea, ton, etc. Required to interpret `qty`. |
| `"Pounds per Unit"` | decimal | Weight per unit. Required for any per-pound metric. |
| `name` | text | Product line or location label, contextual. |
| `itemloc` | text | Item location code. |

### Fulfillment and freight

| Column | Type | Notes |
|---|---|---|
| `"Production Site"` | text | Manufacturing site. |
| `"Freight Type"` | text | Van, Flatbed, LTL, etc. |
| `"Freight Company"` | text | Carrier name. |
| `"Logistics Company"` | text | Logistics provider. |
| `"Freight Owner"` | text | Freight responsibility or channel. |

### Ignore

`user_15` (inconsistent), `user_18` (all zeros), `user_19` (all zeros),
`user_25` (usually empty). Do not query, report, or reason from these.

---

## 7b. Customer identity

**`cusname` is an account name, not a customer.** The same commercial relationship
appears under multiple `cusname` values, and `"Parent Company"` is what ties them
together.

Worked example, all-time product revenue:

| cusname | Parent Company | Orders | Revenue |
|---|---|---|---|
| Synthetic Grass Warehouse | Tencate | 1,132 | $10.20M |
| Challenger Turf, Inc. | Tencate | 700 | $5.60M |
| California Turf Warehouse, Inc | Tencate | 22 | $190.6K |
| Synthetic Lawns & Golf, Inc | Tencate | 21 | $100.3K |
| SGW Fresno | Tencate | 7 | $61.2K |
| Synthetic Greens Warehouse FL | Tencate | 5 | $47.7K |
| Nevada Artificial Grass | Tencate | 3 | $24.0K |
| Tiger Turf New Zealand Ltd | Tencate | 1 | $9.5K |

Tencate totals $16.23M across 1,891 orders. Reported on `cusname`, the largest
single row is $10.20M. Any "top customer" ranking built on `cusname` understates
grouped accounts and is wrong at the relationship level.

State which level you used. "Synthetic Grass Warehouse, $10.2M as a single
account" and "Tencate, $16.2M across eight accounts" are both defensible and mean
different things. Ask if the question turns on it.

### `"Parent Company"` has a catch-all bucket

The value `Other` is assigned to independent accounts with no group affiliation.
It is not a company. A bare `GROUP BY "Parent Company"` therefore produces a fake
top customer called `Other` aggregating unrelated businesses.

Treat `Other` the way you treat a null grouping value: report it as
unaffiliated, never as an entity. When rolling up by parent, either exclude
`Other` and report those accounts individually, or label the bucket explicitly.

### Name matching is unreliable

Searching `cusname LIKE '%Synthetic%'` returns 20 rows, of which 16 are unrelated
companies that merely share the word. Filter candidates by `"Parent Company"`
before concluding two names are the same customer.

There is no systematic abbreviation convention. `LIKE '%SGW%'` matches exactly one
row, so `SGW Fresno` is an anomaly rather than evidence of an `SGW <City>` naming
pattern.

### Locations are delivery cities, not customers

A regional branch is usually the same `cusname` distinguished by
`"Delivery City"` and `"Delivery State"`, not a separate account. "SGW Anaheim" is
`cusname = 'Synthetic Grass Warehouse'` filtered to Anaheim, CA.

Before reporting that a customer or location is absent, search widely: partial
`LIKE` on both the abbreviation and its expansion, `"Parent Company"`, and the
delivery city and state fields. Then say what you did find and how it relates. "No
exact match for X, but Y appears to be the same account" is useful. "X does not
exist" is a claim that usually cannot be supported from this data.

### Text fields are not case-normalized

`"Delivery City"` contains both `Anaheim` and `ANAHEIM`. Any equality filter or
`GROUP BY` on a text field will silently split one value into several. Use
`UPPER()` on both sides, and expect the same hazard on any other free-text column.

---

## 8. Known data quirks

**`qty` is not one unit of measure.** This is the most dangerous quirk in the dataset
because it produces plausible wrong answers rather than errors.

Two real rows from the same invoice date:

| class | price | qty | price * qty |
|---|---|---|---|
| ENVIRO | 0.199 | 630,000 | 125,370 |
| DEL-SPOR | 2,115.00 | 1 | 2,115 |

The first is bulk material priced per pound, so `qty` is a weight. The second is a
freight line priced per delivery, so `qty` is 1 and `price` carries the entire charge.
Standard bagged product uses `qty` as a count of 50 lb bags. All three coexist in the
same column.

`price * qty` is correct for every one of them, which is why revenue math is safe.

**These are not safe** across unsegmented rows, and will return a confident number that
means nothing:

- `SUM(qty)` — adds pounds to bag counts to delivery counts
- `AVG(price)` — averages a per-pound rate against a per-delivery charge
- `COUNT` of units, or any per-unit metric
- Any "average order size" expressed in units rather than dollars

If a question requires units, weights, or per-unit rates, first segment by
`"Unit Of Measure"`, and convert using `"Pounds per Unit"`. Never infer the
denomination from the SKU string alone. If the question cannot be segmented cleanly,
say so rather than returning a blended figure.

**Nulls on grouping dimensions.** `"Sales Region"`, `repnum`, and
`"Landscape/Sports"` are known to contain nulls on revenue bearing rows. Report the
null bucket as unassigned. Never drop it.

**Null invoice dates.** Rows can exist with an order date and no invoice date, meaning
ordered and not yet billed. Period revenue keyed on `invdate` excludes them, which is
correct, but do not describe such a period as complete order activity.

**One order, many rows.** Every aggregate over orders needs `COUNT(DISTINCT quotenum)`.
`COUNT(*)` counts line items and will overstate order volume roughly two to one.

**A class filter changes what an order count means.** `COUNT(DISTINCT quotenum)`
under the product-revenue filter counts orders containing at least one product
line, silently excluding delivery-only orders. For a question about how many
orders a customer placed, apply no class filter. Reserve the product filter for
revenue and margin. Say which you used when the distinction could matter.

---

## 9. Verified anchors

Computed against the live dataset with a boundary of `MAX(invdate) = 2026-08-05`.
Recompute rather than quoting these if the boundary has moved materially.

### All-time totals

These three reconcile exactly. If a recomputation does not, a class has been added or
a filter is wrong.

| Measure | Filter | Amount |
|---|---|---|
| Total billed | none | $93,186,577 |
| Freight | `class IN ('DEL-LAND','DEL-SPOR','DELIVERY')` | $13,392,202 |
| Product revenue | `class NOT IN ('DEL-LAND','DEL-SPOR','DELIVERY')` | $79,794,375 |

Line items: 18,648. Distinct classes: 15.

### Class contribution, all-time

| class | lines | ext revenue |
|---|---|---|
| ENVIRO | 9,532 | $66,681,983 |
| DEL-LAND | 6,259 | $11,396,502 |
| SAFSHELL | 253 | $5,189,489 |
| HOMEDEP | 263 | $4,488,953 |
| DEL-SPOR | 255 | $2,084,033 |
| SMOOTHPL | 51 | $1,334,220 |
| EMERALD | 411 | $868,779 |
| PROPLAY | 148 | $573,947 |
| RAWSAND | 148 | $565,347 |
| ALVEOPAD | 38 | $146,020 |
| `''` | 580 | $55,849 |
| PARTIAL | 510 | $13,385 |
| HTPALLET | 46 | $12,870 |
| DELIVERY | 53 | -$88,333 |
| DISCOUNT | 101 | -$136,467 |

ENVIRO is 83.6% of product revenue and 71.6% of total billed. Freight lines
(`DEL-LAND` alone at 6,259) are a third of all line items, which is why line counts and
order counts diverge so sharply from dollar shares.

### 2025 full year, verified

Product revenue, three-class delivery exclusion, `invdate` within calendar 2025.

| Segment | Orders | Lines | Revenue | Cost | Profit | Margin |
|---|---|---|---|---|---|---|
| Landscape | 1,298 | 1,735 | $10,121,117 | $6,194,650 | $3,926,467 | 38.8% |
| Sports | 83 | 85 | $3,013,885 | $2,048,938 | $964,947 | 32.0% |
| **Total** | **1,381** | **1,820** | **$13,135,002** | **$8,243,588** | **$4,891,414** | **37.2%** |

Every 2025 product dollar carries a segment label. No null or empty-string segment
appeared. This has not been checked for earlier years.

The two segments have different shapes and should rarely be blended. Landscape averages
$7,798 per order across 1,298 orders at 1.34 lines each. Sports averages $36,312 per
order across 83 orders at 1.02 lines each, which is single-line project work. Any
blended average order value describes neither segment.

Sports carries nearly seven points less margin than Landscape.

### 2025 freight, verified

`class IN ('DEL-LAND','DEL-SPOR','DELIVERY')`, `invdate` within calendar 2025.

| class | lines | billed | carrier cost | recovery | margin |
|---|---|---|---|---|---|
| DEL-LAND | 907 | $1,496,348 | $1,320,089 | $176,258 | 11.78% |
| DEL-SPOR | 53 | $393,289 | $347,044 | $46,245 | 11.76% |
| DELIVERY | 1 | -$300 | $0 | -$300 | n/a |
| **Total** | **961** | **$1,889,337** | **$1,667,133** | **$222,204** | **11.76%** |

`cost` is populated on delivery rows, so freight recovery is answerable from this
dataset.

Freight is a small profit center overall. Roughly 13.3% markup on carrier cost, 11.8%
margin on billed.

**Do not read the class-level uniformity as policy pricing.** The two lanes land within
two basis points of each other, but that is an aggregation artifact: one carrier holds
71% of lines and 82% of billed dollars, so the blend inherits that carrier's rate. Actual
recovery ranges from -6% to 18% once segmented. Any freight answer given at class level
will understate the real variance. Always segment freight by `"Freight Company"` and
`"Freight Type"`.

`DELIVERY` is effectively a legacy class. One row in 2025, 53 all-time, always negative.
It must stay in the freight filter for correctness, but it is immaterial in dollars and
should not be called out in answers unless a total fails to reconcile.

Delivery lines do not appear on every order. 907 delivery lines against 1,298 Landscape
orders, and 53 against 83 Sports orders, so roughly 30% of orders carry no delivery
charge. Cause not established; do not assume it means free freight.

### 2025 freight recovery by carrier and mode

Twelve carrier and mode combinations covering all 961 freight lines. `"Freight Company"`
is fully populated; `"Freight Type"` is blank on two Steam lines. Cardinality is low
enough that freight groupings need no pagination.

| carrier | mode | lines | billed | carrier cost | recovery | margin |
|---|---|---|---|---|---|---|
| Steam | (blank) | 2 | $10,884 | $8,925 | $1,959 | 18.0% |
| Estes | LTL | 64 | $56,002 | $47,025 | $8,977 | 16.0% |
| Morenos | Flatbed | 66 | $27,310 | $23,450 | $3,860 | 14.1% |
| CHR | LTL | 64 | $70,218 | $60,314 | $9,904 | 14.1% |
| XPO | LTL | 28 | $22,061 | $18,991 | $3,070 | 13.9% |
| ATS | Flatbed | 10 | $14,530 | $12,525 | $2,005 | 13.8% |
| OD | LTL | 17 | $16,098 | $13,970 | $2,128 | 13.2% |
| CHR | Van | 443 | $796,844 | $702,078 | $94,766 | 11.9% |
| CHR | Flatbed | 179 | $685,349 | $604,391 | $80,958 | 11.8% |
| NFL | Van | 1 | $4,115 | $3,750 | $365 | 8.9% |
| NFL | Flatbed | 84 | $175,826 | $161,000 | $14,826 | 8.4% |
| Mercer | Flatbed | 3 | $10,100 | $10,715 | -$615 | -6.1% |

Patterns worth carrying into answers:

- LTL recovers above the blended rate across every carrier. Van and Flatbed mostly sit at
  or below it.
- CHR holds 82% of freight spend. Concentration, not just a pricing fact.
- Lanes with fewer than about ten lines are not patterns. A single negative-recovery job
  is more likely a spot-market delivery commitment than a pricing failure, and should not
  be presented as a leak.

### Total billed reconciliation, 2025

| Component | Amount |
|---|---|
| Product revenue | $13,135,002 |
| Freight | $1,889,337 |
| **Total billed** | **$15,024,339** |

### Figures retired as wrong

The prior reference asserted several numbers that do not survive verification. They are
listed here so they are recognized and rejected if they resurface:

- "$85M revenue" for the dataset. Neither total billed nor product revenue has ever been
  $85M. The real pair is $93.2M and $79.8M.
- "17,046 transactions." Actual line count is 18,648.
- "ENVIRO $61M, 72% of revenue." The 72% was computed against total billed with no
  delivery exclusion, confirming every headline figure in that file measured something
  different from what its own rules defined.
- "Top customer: Synthetic Grass Warehouse, $10.5M." Computed on `cusname`, which
  is an account name rather than a customer. That account is one of eight under
  parent Tencate, which totals $16.23M. The figure is not merely stale; the
  grouping level was wrong. See section 7b.
- "Landscape $11.6M, Sports $3.4M" for 2025. Both were delivery-inclusive, folding
  `DEL-LAND` into Landscape and `DEL-SPOR` into Sports, which is why they summed to
  $15.0M against a correct product total of $13.1M. The $13.1M headline itself was
  accurate; only the segment split was wrong.

### Still unverified

Do not state these as fact:

- Current year to date, and any period other than calendar 2025. Note that year to date
  figures must never be recorded in this file; compute them per section 2
- Segment coverage before 2025, meaning how much older revenue carries a null or
  empty-string `"Landscape/Sports"`
- Null exposure on `"Sales Region"` and `repnum`, which the prior reference defended
  against with `IS NOT NULL` and which remains unquantified
- Customer count, previously claimed as 316
- SKU count, previously claimed as 73
- Whether `FFItem_Itemnum` always equals `itemnum`
- Freight per pound, and recovery by destination state or lane. Carrier and mode are now
  measured for 2025; geography and weight normalization are not
- Why roughly 30% of orders carry no delivery line
