
---

# 🧩 RAGBIT Exchange — Wave 4 Technical Documentation

**Contract Address:** `0xC0eB50d7dB5dFd92c81F3850e3AD12aAB804F790`
**Wave:** 4 — Buyer–Seller Secure Data Exchange

---

## 🧠 Overview

Wave 4 introduces a **peer-to-peer encrypted key exchange layer** that enables secure transfer of decryption keys between buyers and sellers **after payment verification** on-chain.

This layer connects three systems:

1. **Smart Contract Layer (Settlement):**
   Manages purchase commitments and validates payments on-chain.

2. **Off-Chain Signaling Layer (Metalayer Gateway):**
   Implements socket-based buyer/seller matching, message routing, and event relay for WebRTC and key exchange.

3. **Data Storage Layer (0G):**
   Hosts encrypted datasets, referenced by their `rootHash`, ensuring integrity and verifiability.

---

## 🔗 Flow Summary

### 1. Seller Initialization

* Seller uploads data to 0G:

  * Data is chunked, Merkle-hashed, and uploaded.
  * The resulting `rootHash` acts as the dataset’s fingerprint.

* Seller registers metadata off-chain:

  * `{ rootHash, summary, price }` stored in an exchange database or registry.

* On-chain, the seller’s dataset is available for purchase via:

  * `purchase(rootHash)` → emits an event with buyer address & rootHash.

---

### 2. Buyer Purchase

* Buyer browses available datasets via frontend → sees summary (from DB) & on-chain contract link.
* Buyer calls the `purchase()` function on the deployed contract:

  * Transaction is sent to:
    `0xC0eB50d7dB5dFd92c81F3850e3AD12aAB804F790`
  * Payment is logged and emits `PurchaseInitiated(rootHash, buyer)` event.

---

### 3. Gateway Event Relay (Metalayer Signaling Server)

* The backend **Node.js signaling gateway** listens for socket connections:

```js
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('identify', (data) => {
    socket.data.role = data.role;
    if (data.role === 'seller') sellers.set(socket.id, socket);
    else buyers.set(socket.id, socket);
  });

  socket.on('purchase', (payload) => {
    console.log('purchase payload', payload.rootHash);
    // (future) verify payment via RPC -> then notify seller
  });
});
```

* Buyers and sellers identify themselves as roles via `socket.emit('identify', { role: 'buyer' })`.

---

### 4. Secure P2P Channel Establishment

Once purchase is confirmed, the gateway acts as a **signaling server** to set up a **direct encrypted channel** between buyer and seller using **WebRTC**.

* **Buyer** sends an SDP offer → forwarded via server:

  ```js
  socket.emit('signal-offer', { toSocketId, sdp });
  ```
* **Seller** responds with an SDP answer and ICE candidates to finalize the connection.

---

### 5. Ephemeral Key Exchange

When the **DataChannel** opens:

* Seller generates an **ephemeral NaCl keypair** and encrypts the symmetric dataset key `K` using buyer’s public key (`pk_b`):

  ```js
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const cipher = nacl.box(Kbytes, nonce, buyerPk, sellerSk);
  ```

* Seller sends `{ nonce, cipher, senderPk }` over the established WebRTC channel.

* Buyer decrypts:

  ```js
  const decryptedK = nacl.box.open(cipher, nonce, senderPk, buyerSk);
  ```

* This gives the buyer the symmetric key `K` for decrypting the file from 0G.

---

### 6. File Retrieval and Decryption

* Buyer downloads the encrypted file from 0G using the `rootHash`.
* Uses the received symmetric key `K` to decrypt locally:

  ```js
  const decrypted = AES.decrypt(encryptedBlob, K);
  ```

No intermediaries, including the signaling server or 0G storage nodes, can access the file content.


