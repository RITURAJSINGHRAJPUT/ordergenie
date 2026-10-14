# Petpooja API request — Beshak (draft email)

Extends our existing Petpooja integration (live for Capiche and Aiko) to the third brand, Beshak.

**Before sending**
- Fill in each Beshak outlet's name, Petpooja RID and city. Double-check the RIDs — last time Petpooja couldn't locate some of the IDs we sent.
- If Beshak also has its own store or prep kitchen (like the KG locations), add **Inventory API** and **Inventory Transfer API** for those locations.
- Send from bookendsdataanalyst@gmail.com, which Petpooja already knows from tickets ## 6610237 ## and ## 6901477 ##.

---

**To:** support@petpooja.com
**Cc:** karp.patel@petpooja.com, shivam.tiwari1@petpooja.com, pinesh.thakor@petpooja.com
**Subject:** API access for our new brand Beshak – Orders API, Purchase API and PO webhook

Hi Team,

We have launched a third restaurant brand, **Beshak**. We would like to extend our existing Petpooja API integration to its outlets, with the same setup already live for our Capiche and Aiko outlets.

**Beshak outlets:**

| Outlet name | RID | City |
|---|---|---|
| [Beshak outlet 1] | [RID] | [City] |
| [Beshak outlet 2] | [RID] | [City] |

Please enable the following for each outlet above:

1. **Orders API** (`generic_get_orders`) for sales and bill data. Please share the restID mapping code for each outlet. (Earlier ticket: ## 6610237 ##)
2. **Purchase API** (`get_purchase`) with purchase header, item details, supplier/vendor details, invoice number, purchase number, quantity, unit, rate, amount and GST. Please share the Menu Sharing Code for each outlet. (Earlier ticket: ## 6901477 ##)
3. **Purchase Order webhook**: please include these outlets in the purchase-order push to our existing webhook endpoint, the same as our current outlets.

We would like to use the same App Key, App Secret and Access Token as our existing integration. If the Beshak outlets need separate credentials, please share them.

Please also send the charges for adding these outlets, at the per-outlet annual API fee, along with the invoice or payment link so we can complete payment quickly.

Thank you,
[Your name]
Bookends Hospitality
[Phone number]
