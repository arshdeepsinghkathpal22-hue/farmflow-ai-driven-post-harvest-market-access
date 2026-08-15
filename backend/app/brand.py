"""The product's name, in one place.

Mirrors ``web/src/brand.js``. Kept as a separate constant rather than imported
from the frontend because the backend must be able to sign and verify receipts
with no Node toolchain present - but the two files must agree on
``RECEIPT_PREFIX`` or receipts signed by one will not verify in the other.
"""

# Change this line to rename the product.
NAME = "FarmFlow"

TAGLINE = "No farmer is too small to store"

DESCRIPTION = "Micro cold storage and market access for small Indian farmers"

# Stamped into every signed receipt. Must match `receiptPrefix` in
# web/src/brand.js. Changing it invalidates receipts issued under the old value.
RECEIPT_PREFIX = "FFWR2"

SHORT_CODE = "FF"
