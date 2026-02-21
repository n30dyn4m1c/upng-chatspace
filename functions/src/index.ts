// Deploy with: firebase deploy --only functions
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()
const db = admin.firestore()

/**
 * Scheduled cleanup: runs every 1 minute to delete expired messages.
 */
export const scheduledCleanup = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now()
    const expired = await db
      .collection('messages')
      .where('expiresAt', '<', now)
      .get()

    if (expired.empty) return null

    // Batch delete in groups of 500 (Firestore batch limit)
    const batches: admin.firestore.WriteBatch[] = []
    let batch = db.batch()
    let count = 0

    for (const doc of expired.docs) {
      batch.delete(doc.ref)
      count++
      if (count % 500 === 0) {
        batches.push(batch)
        batch = db.batch()
      }
    }
    if (count % 500 !== 0) {
      batches.push(batch)
    }

    await Promise.all(batches.map((b) => b.commit()))
    functions.logger.info(`Deleted ${count} expired messages`)
    return null
  })

/**
 * On message create: flood detection.
 * If a user sends > 100 messages in 10 minutes, ban them and delete the message.
 */
export const onMessageCreate = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    const data = snap.data()
    const uid = data.uid as string
    const tenMinutesAgo = admin.firestore.Timestamp.fromMillis(
      Date.now() - 10 * 60 * 1000
    )

    const recentMessages = await db
      .collection('messages')
      .where('uid', '==', uid)
      .where('timestamp', '>', tenMinutesAgo)
      .get()

    if (recentMessages.size > 100) {
      // Ban the user and delete the triggering message
      await Promise.all([
        db.doc(`users/${uid}`).update({ banned: true }),
        snap.ref.delete()
      ])
      functions.logger.warn(`Banned user ${uid} for flood (${recentMessages.size} messages in 10min)`)
    }
  })
