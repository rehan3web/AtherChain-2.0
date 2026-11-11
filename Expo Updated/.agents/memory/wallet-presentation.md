---
name: Wallet presentation
description: User-requested wallet denomination format and success toast placement.
---

Keep only the complete AtherChain wallet, including Send, Receive, Swap, settings and transaction history. Remove alternate-network wallets, the network selector/list, Add Network and custom network settings features.

**Why:** The user explicitly changed the product scope to “sirf AtherChain full wallet” and clarified that Send, Receive and Swap must remain.

**How to apply:** Do not reintroduce other-network wallets or network-adding controls. Do not interpret this removal as permission to remove AtherChain Swap or its existing wallet functions.

Show the wallet balance as a large numeric amount with two decimals and no grouping, followed by a smaller, lower-baseline ATH unit, like the dashboard AT balance—not an ATH prefix or a dollar symbol.

**Why:** The user first requested ATH instead of dollars, then explicitly changed the balance presentation to match the dashboard's smaller end-position unit.

**How to apply:** Preserve number animation, two decimals, hiding behavior and the smaller trailing unit. This does not change numerical balances or unrelated currencies. Receipts and transaction lists use the suffix rule below.

For receipts and transaction lists, put ATH after the amount, e.g. `2.00 ATH`, not `ATH 2.00`. The large receipt summary shows only amount and date, without a repeated “To” email/username; recipient information stays in the lower Receiver/Sender details.

**Why:** The user explicitly corrected receipt/list symbol placement and asked to remove the duplicate recipient line below the large amount.

**How to apply:** Apply to immediate and reopened receipts, wallet transaction previews and the activity/transaction feed. Preserve existing precision and unrelated currencies.

Preserve the original spacious, scrollable receipt layout for both transfer and swap receipts. Do not compact the rows to fit everything onto one screen.

**Why:** After seeing the compact version, the user explicitly asked to restore all old receipt UI, keeping only the amount/date-only top summary.

**How to apply:** Keep the original padding, large summary and detail rows, and let receipts scroll. Preserve suffix amounts and the simplified amount/date summary. Do not reintroduce adaptive compact spacing.

Swap is AT → ATH only, replacing BTC → HYPE, with no coin dropdown or reverse control. Use the supplied Ather mark for both tokens, black in light mode and white in dark mode. Remove dollar-price equivalents; show token amounts consistently in the swap, review and receipt.

**Why:** The user supplied the logo variants, requested AT above and ATH below, and later clarified that swap must have no dropdown. They also explicitly want the actual logo image files on GitHub.

**How to apply:** Bundle tracked logo assets rather than only inline SVG code, preserve transparent proportions, keep generated activity and receipts consistent with the fixed pair, and denominate the fee in AT. This remains a simulated swap, not a real exchange.

Swap entry opens full screen with AT as the only editable amount, Max inside its field, read-only ATH calculated at exact 1 AT = 1 ATH, the shared wallet keypad, and Swap below it. Keep the pay/receive boxes spacious, with each token header above its amount row and a trailing amount unit. Separate Max from the pay amount with clear space; use a black button with white text in light mode and a white button with black text in dark mode.

**Why:** The user explicitly requested this entry layout, shared keypad and 1:1 conversion. They later asked for larger boxes and amounts below the token headers because the amount, token and Max were crowded together, and specified Max's opposite light/dark colors.

**How to apply:** Use zero demo swap fees so the received amount remains exactly 1:1. Preserve review, activity and receipt quantities from the entered amount and never open the native keyboard. The current practice Max uses the existing wallet demo amount as its limit; it is not a separate AT ledger and no real assets or wallet balances move.

Keep Swap's keypad UI consistent with the OTP and wallet Send Money keypads: each key must have a clearly visible rounded box, with light-grey keys on the light-mode white sheet surface. Keep the amount fields lower rather than immediately below the header. Preserve the rest of the existing UI.

**Why:** The user explicitly requested matching keypad UI and said the Swap input field was too high. They then supplied a Send Money screenshot and corrected the spacing-only change: they meant visible box buttons, not just matching positions.

**How to apply:** Reuse the shared keypad, preserve its contrast against the surrounding screen rather than blending its boxes into a similar grey page, constrain wide-screen stretching, and keep controls reachable on short screens. Check the actual rendered key and surrounding surface together.

Keep notifications at the top, not the bottom. Preserve the original Referral/Invite Friend toast position; Send and Swap modal toasts should sit slightly lower than the top edge.

**Why:** The user corrected the earlier bottom-placement interpretation: “toast upper top m hi rkhne h … reffral ka old … best tha … wallet swap … buhat upper tha”.

**How to apply:** Keep the same shared notification appearance and queue. Preserve root/reference placement, add modest modal-specific safe-top clearance, and verify the settled modal position rather than measuring during its slide-in animation. Do not move toasts to the bottom again.

In dark mode, the Mining Claim button and main wallet Send button must be white with black text.

**Why:** The user explicitly clarified “White buttons, black text” when the original wording could mean either color direction.

**How to apply:** Preserve the existing light-mode presentation, and apply the contrasting dark foreground to button labels, icons and busy spinners. Do not change every primary action globally.
