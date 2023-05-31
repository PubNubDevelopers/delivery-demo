/**
 * Configure the PubNub object.
 * Key configuration is handled in a separate file, keys.js
 */

//  Ideally the PubNub object will be created with an ID based on the URL query string but if that is not specified, generate a new URL and store it in session storage.
async function createPubNubObject (presetUUID) {
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
  var accessManagerToken = await requestAccessManagerToken(UUID);
  if (accessManagerToken == null)
  {
    console.log('Error retrieving access manager token')
  }
  else
  {
    pubnub.setToken(accessManagerToken)
    //  The server that provides the token for this app is configured to grant a time to live (TTL)
    //  of 360 minutes (i.e. 6 hours).  IN PRODUCTION, for security reasons, you should set a value 
    //  between 10 and 60 minutes and refresh the token before it expires.
    //  For simplicity, this app does not refresh the token
  }
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

async function requestAccessManagerToken (userId) {
  try {
    const TOKEN_SERVER = 'https://devrel-demos-access-manager.netlify.app/.netlify/functions/api/deliverydemo'
    const response = await fetch(`${TOKEN_SERVER}/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ UUID: userId })
    })

    const token = (await response.json()).body.token
    //console.log('created token: ' + token)

    return token
  } catch (e) {
    console.log('failed to create token ' + e)
    return null
  }
}
