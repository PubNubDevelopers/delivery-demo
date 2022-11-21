/**
 * Configure the PubNub object.
 * Key configuration is handled in a separate file, keys.js
 */

//  Ideally the PubNub object will be created with an ID based on the URL query string but if that is not specified, generate a new URL and store it in session storage.
function createPubNubObject (presetUUID) {
  var UUID = presetUUID // Allows you to force a uuid
  let savedUUID = null
  if (!UUID) {
    try {
      savedUUID = sessionStorage.getItem('uuid')
    } catch (err) {
      console.log('Session storage is unavailable')
    } //  Session storage not available
    if (!savedUUID) {
      UUID = makeid(20) // Make new UUID
    } else {
      UUID = savedUUID
    }
  }
  try {
    sessionStorage.setItem('uuid', UUID)
  } catch (err) {} //  Session storage is not available

  //  Publish and Subscribe keys are retrieved from keys.js
  var pubnub = new PubNub({
    publishKey: publish_key,
    subscribeKey: subscribe_key,
    uuid: UUID
  })
  return pubnub
}

function makeid (length) {
  var result = ''
  var characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

function testPubNubKeys () {
  if (publish_key === '' || subscribe_key === '') return false
  else return true
}
