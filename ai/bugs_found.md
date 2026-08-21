# Bugs and Structural Issues Log

Below is the list of architectural and logic bugs found in the current codebase.

### 1. Client-Side Wallet Manipulation (CRITICAL)
- **File**: `firestore.rules`, `js/app.js`
- **Issue**: The `wallet.balance` is updated directly from the client. The Firestore rules explicitly allow `request.resource.data.wallet.balance` to be written by the user.
- **Risk**: Any user with basic technical knowledge can modify the network request or use the browser console to set their wallet balance to any amount (e.g., 99999).
- **Fix**: Move all financial logic (debits/credits) to Firebase Cloud Functions. The client should only call a function, and the server must verify the transaction.

### 2. Race Conditions on Views and Likes (MODERATE)
- **File**: `firestore.rules`, `js/app.js`
- **Issue**: Counters like `viewCount`, `likeCount`, and `dislikeCount` are incremented directly by the client. The rules use a custom `stepped()` function to limit the increment to +1.
- **Risk**: In a highly concurrent environment (multiple users liking/viewing at the same time), direct document updates cause "Transaction Contention" and race conditions. Some likes or views will be overwritten and lost.
- **Fix**: Use `FieldValue.increment(1)` combined with a subcollection to track who liked the post. For high-traffic counters, use distributed counters or Cloud Functions.

### 3. Dare/Mission Reward Modification (HIGH)
- **File**: `firestore.rules`
- **Issue**: The rules allow the creator to modify the mission (including the reward amount) up until someone accepts it. 
- **Risk**: A creator could quickly change the reward amount just milliseconds before someone accepts it, or a race condition could allow the amount to change right as the acceptance goes through.
- **Fix**: Once a dare is created with a bounty, the funds should be locked in escrow immediately. The reward amount field should be read-only after creation.

### 4. Over-reliance on Client-side Rule Enforcement (MODERATE)
- **File**: `js/app.js`
- **Issue**: Some states (like checking if a user is eligible to take a dare) are checked entirely on the client-side (`js/app.js`) before sending the write. 
- **Risk**: Client-side checks can be bypassed. Ensure every critical state transition (like taking a dare, approving a proof) is strictly enforced in `firestore.rules` or a backend function, not just hidden in the UI.

### 5. Potential XSS / DOM Manipulation Vulnerabilities (LOW/MODERATE)
- **File**: `js/app.js`
- **Issue**: With a 600KB+ vanilla JS file heavily modifying the DOM, there is a risk of improper escaping if user-generated content (like comments or dare descriptions) is inserted directly into the DOM (e.g., via `innerHTML` or similar properties, though direct `innerHTML` usage seems limited).
- **Fix**: Ensure all user-generated content is sanitized or inserted via `textContent` / `innerText`.

### 6. Scam Vulnerability: Creator Deleting Proofs (CRITICAL)
- **File**: `firestore.rules` (Line 287)
- **Issue**: The `delete` rule for the `proofs` collection allows the mission creator (`posterId`) to delete a proof submitted by someone else. 
- **Risk**: A malicious creator can ask for a proof, wait for it to be submitted, and then delete the proof document to avoid paying the reward. The proof disappears completely, and the mission doesn't count as complete.
- **Fix**: Remove `resource.data.posterId == uid()` from the `delete` rule on `proofs`. Proofs should only be soft-deleted, or deleted by the taker (`takerId`), or strictly handled by a backend.

### 7. Creators Cannot Moderate Comments (MODERATE)
- **File**: `firestore.rules` (Line 328)
- **Issue**: The `delete` rule on the `comments` collection only allows the comment author (`userId == uid()`) or an admin to delete a comment.
- **Risk**: Creators cannot delete abusive or spam comments posted on their own missions or video proofs. 
- **Fix**: Add a condition to `allow delete` checking if `pinnerOfProof()` or `pinnerOfDare()` is true (which means the user owns the content being commented on).

### 8. Counters Exploit: takers and proofCount (HIGH)
- **File**: `firestore.rules` (Line 211)
- **Issue**: The `update` rule for `dares` allows updating `takers` and `proofCount` while checking `steppedAll()`. However, `steppedAll()` only checks `likeCount`, `dislikeCount`, and `viewCount`—it doesn't validate `takers` or `proofCount`.
- **Risk**: Any user can artificially inflate or deflate the `takers` and `proofCount` fields on any mission by an arbitrary amount (e.g., setting it to 1000000).
- **Fix**: Add `&& stepped('takers') && stepped('proofCount')` to the `steppedAll()` function or to the update condition.

### 9. Hijacking Applicant Documents (MODERATE)
- **File**: `firestore.rules` (Line 232)
- **Issue**: The `applicants` subcollection has an `allow update: if isDareOwner();` rule but lacks an `onlyTouches()` constraint.
- **Risk**: The mission creator can modify ANY field on the applicant's document, including changing the `uid` of the applicant, which would lock the applicant out of their own application data.
- **Fix**: Enforce `onlyTouches(['status'])` on the applicant update rule for mission owners.

### 10. Missing `type="button"` on Interactive Elements (LOW/UI)
- **File**: `index.html`
- **Issue**: There are over 150 `<button>` tags without a `type="button"` attribute defined. 
- **Risk**: While currently safe, if any of these sections are ever wrapped in a `<form>` element (e.g., for accessibility or autocomplete features in the future), these buttons will default to `type="submit"`. Clicking them would unexpectedly trigger a full page reload, destroying the Single Page App (SPA) state and causing a terrible UX.
- **Fix**: Add `type="button"` to all buttons that act as JS triggers, keeping `type="submit"` only for actual form submissions.
