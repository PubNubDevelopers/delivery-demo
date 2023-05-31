/**
 * Main entry point for communication coming from PubNub
 */

var pubnub = null
//  Global array to store all vehicles that are created.  Will contain all vehicles, both inflight and ones with routes completed.
var vehicles = null
//  The channel name will be based on the URL query string (if provided), allowing us to efficiently retrieve historical messages, required to determine deliveries in progress when the page is launched
var channelName = null
//  Array of deliveries which, according to PN history, are in progress before we loaded
var potentialInFlightDeliveries = []

async function onload () {
  vehicles = {}
  if (!testPubNubKeys()) {
    document.getElementById('noKeysAlert').style.display = 'block'
  } else {
    //  The interactive demo provides a unique ID for the user in the URL query string, ideally use this for our ID to produce a superior experience on multiple devices so they have the same view of the data.
    var queryString = new URL(window.location.href).search.substring(1)
    var identifier = null
    const urlParamsArray = queryString.split('&')
    for (let i = 0; i < urlParamsArray.length; i++) {
      if (
        urlParamsArray[i].startsWith('identifier') &&
        urlParamsArray[i].includes('=')
      ) {
        var identifierPair = urlParamsArray[i].split('=')
        identifier = identifierPair[1]
      }
    }
    if (identifier === null) {
      console.log(
        'Not running within Interactive demo.  When running app in multiple windows, be sure to load the second window before requesting vehicle'
      )
    }
    pubnub = await createPubNubObject(identifier)
    //  Although the map will listen for ALL vehicles (so you can see other people using the demo), all summoned vehicles by the same user will share a channel
    //  Requires stream controller to be enabled
    channelName = 'vehicle.' + pubnub.getUUID()

    //  Retrieve the past 100 messages on the channel (channel name here is based on URL query string, where specified).  There are 2 messages associated with each delivery, one to say the delivery has started and one to say the delivery has finished, so this will capture up to 100 in-flight deliveries, but in reality it will depend on whether some of those deliveries have finished in the mean-time and how many messages were sent to the vehicle driver.  Practically, you are going to capture all the deliveries the user has requested but increasing this number will not have a negative impact.
    try {
      const result = await pubnub.fetchMessages({
        channels: [channelName],
        count: 100
      })
      processHistoricalMessages(result)
    } catch (status) {
      displayError(
        'PubNub History call failed.  <br/>Do you have persistence enabled on your keyset?'
      )
    }

    //  PubNub listener for status, messages and signals
    await pubnub.addListener({
      //  Status events
      status: async statusEvent => {
        //  Channel subscription is now complete, pre-populate with simulators.
        //console.log(statusEvent)
      },
      //  Messages are sent when a route is started or stopped.  Messages are also recevied from vehicles to say when to show or hide the info window.
      message: async payload => {
        //console.log(payload.message)
        if (payload.message.state === 'START_ROUTE') {
          if (vehicles[payload.publisher] != null) {
            //  Tried to start duplicate route (sometimes happens when debugging web workers)
            return
          }
          //  New Route
          initializeDeliveryRoute(
            payload.publisher,
            payload.message.route,
            payload.message.theme,
            payload.message.themeSpecificData,
            payload.channel
          )
          locationUpdateReceived(
            payload.publisher,
            payload.message.lat,
            payload.message.lng,
            0
          )
          updateVehicleEta(payload.publisher)
        } else if (payload.message.state === 'END_ROUTE') {
          //  Hide the route on the UI (but keep the vehicle info window)
          clearDestinationMarker(payload.publisher)
          clearVehicleMarker(payload.publisher)
          actionCompleted({
            action: 'Wait until the Driver Arrives',
            debug: false
          }) //  Only used for interactive demo
        } else if (payload.message.state === 'ADD_INFO_WINDOW') {
          //  Display the message in an info window on the Google Map
          showInfoWindow(payload.publisher, payload.message.data)
        } else if (payload.message.state === 'CLEAR_INFO_WINDOW') {
          //  Clear the message from the info window
          hideInfoWindow(payload.publisher)
        }
      },
      //  Signals are sent by the vehicle whenever its position changes.  This is more efficient than using messages for these high-volume changes with small pieces of data.
      signal: async payload => {
        //console.log(payload)
        //  Consider whether this signal was related to a delivery which started before the page was loaded
        for (var inFlight in potentialInFlightDeliveries) {
          if (potentialInFlightDeliveries[inFlight].id == payload.publisher) {
            initializeDeliveryRoute(
              potentialInFlightDeliveries[inFlight].id,
              potentialInFlightDeliveries[inFlight].route,
              potentialInFlightDeliveries[inFlight].theme,
              potentialInFlightDeliveries[inFlight].themeSpecificData,
              potentialInFlightDeliveries[inFlight].originalChannel
            )
            potentialInFlightDeliveries.splice(inFlight, 1)
          }
        }
        locationUpdateReceived(
          payload.publisher,
          payload.message.lat,
          payload.message.lng,
          payload.message.tick
        )
        updateVehicleEta(payload.publisher)
      }
    })

    //  Wildcard subscribe, to listen for all vehicles in a scalable manner
    pubnub.subscribe({
      channels: ['vehicle.*']
    })

    var helpModal = new bootstrap.Modal(
      document.getElementById('helpModal'),
      {}
    )
    helpModal.show()
  }
}

//  Handler to process messages retrieved from history, to cater for a window loaded after a delivery is en-route
function processHistoricalMessages (history) {
  var started = []
  var stopped = []
  //  If we load a new window whilst a delivery is in progress we want to display that delivery on the map.
  //  The problem is we missed the original set-up message, telling us to initialise the route
  //  Search the history for vehicles that are en-route
  if (history != null && history.channels[channelName] != null) {
    for (var i = 0; i < history.channels[channelName].length; i++) {
      if (history.channels[channelName][i].message.state == 'START_ROUTE') {
        started.push({
          id: history.channels[channelName][i].uuid,
          route: history.channels[channelName][i].message.route,
          theme: history.channels[channelName][i].message.theme,
          themeSpecificData: history.channels[channelName][i].message.themeSpecificData,
          originalChannel: history.channels[channelName][i].channel
        })
      } else if (
        history.channels[channelName][i].message.state == 'END_ROUTE'
      ) {
        stopped.push(history.channels[channelName][i].uuid)
      }
    }
  }
  for (var i = 0; i < started.length; i++) {
    if (!stopped.includes(started[i].id)) {
      potentialInFlightDeliveries.push({
        id: started[i].id,
        route: started[i].route,
        theme: started[i].theme,
        themeSpecificData: started[i].themeSpecificData,
        originalChannel: started[i].originalChannel
      })
      //  bit of a hack to keep track of what we have started
      stopped.push(started[i].id)
    }
  }
}
