/**
 * Helper functions for the Vehicle Information Pane
 */

var selectedVehicle = null

//  When the user clicks on the vehicle on the map, the info pane is populated for that vehicle by this function.
function populateVehicleBox (vehicleId) {
  if (vehicles[vehicleId] != null) {
    selectedVehicle = vehicleId
    var themeData = vehicles[vehicleId].themeSpecificData
    var theme = vehicles[vehicleId].theme
    const selectFromMap = document.getElementById('vehicleInfo-selectFromMap')
    const details = document.getElementById('vehicleInfo-details')
    const messageDriver = document.getElementById('vehicleInfo-messageDriver')
    const eta = document.getElementById('vehicleInfo-eta')
    selectFromMap.style.display = 'none'
    var driverName = themeData.generated.driverName
    var detailsText = "<img id='vehicleInfo-driverProfile' src='' />"
    if (theme == THEME_PACKAGE_DELIVERY) {
      detailsText += 'Driver: ' + driverName + '. '
      detailsText += 'Packages: ' + themeData.numOrders + '<br/>'
      detailsText +=
        'Vehicle: ' +
        themeData.generated.vehicleModel +
        '. Reg: ' +
        themeData.generated.vehicleRegistration
    } else if (theme == THEME_TAXI) {
      detailsText += 'Your Driver: ' + driverName + '. <nobr>'
      var rating = themeData.generated.driverRating
      var wholeStars = Math.floor(rating / 2)
      var halfStar = rating % 2 == 1
      var blankStars = 5 - wholeStars
      if (halfStar) blankStars--
      for (var i = 0; i < wholeStars; i++) {
        detailsText += "<i class='fa-solid fa-star'></i>"
      }
      if (halfStar) {
        detailsText += "<i class='fa-regular fa-star-half-stroke'></i>"
      }
      for (var i = 0; i < blankStars; i++) {
        detailsText += "<i class='fa-regular fa-star'></i>"
      }
      detailsText += '</nobr></br>'
      detailsText +=
        'Vehicle: ' +
        themeData.generated.vehicleModel +
        '. Reg: ' +
        themeData.generated.vehicleRegistration
    } else if (theme == THEME_FOOD_DELIVERY) {
      detailsText += 'Driver: ' + driverName + '. <nobr>'
      var rating = themeData.generated.driverRating
      var wholeStars = Math.floor(rating / 2)
      var halfStar = rating % 2 == 1
      var blankStars = 5 - wholeStars
      if (halfStar) blankStars--
      for (var i = 0; i < wholeStars; i++) {
        detailsText += "<i class='fa-solid fa-star'></i>"
      }
      if (halfStar) {
        detailsText += "<i class='fa-regular fa-star-half-stroke'></i>"
      }
      for (var i = 0; i < blankStars; i++) {
        detailsText += "<i class='fa-regular fa-star'></i>"
      }
      detailsText += '</nobr></br>'
      var foodOrder = ''
      for (var i = 0; i < themeData.foodType.length; i++) {
        foodOrder += themeData.foodType[i]
        if (i != themeData.foodType.length - 1) foodOrder += ', '
      }
      detailsText += 'Your Order: ' + foodOrder + '<br/>'
      detailsText +=
        'Vehicle: Motorbike' +
        '. Reg: ' +
        themeData.generated.vehicleRegistration
    }
    details.innerHTML = detailsText
    var driverImage = document.getElementById('vehicleInfo-driverProfile')
    driverImage.src = themeData.generated.driverProfileUrl
    details.style.display = 'block'
    messageDriver.style.display = 'block'
    eta.style.display = 'block'
  }
}

//  Whenever the vehicle's location updates, update the ETA for the selected vehicle
function updateVehicleEta (vehicleId) {
  const eta = document.getElementById('vehicleInfo-eta')
  if (
    vehicles[vehicleId] != null &&
    vehicles[vehicleId].selected == true &&
    eta.style.display == 'block'
  ) {
    var etaInMs =
      (vehicles[vehicleId].route.length - vehicles[vehicleId].driverProgress) *
      simulationInterval

    if (etaInMs < 1000) {
      eta.innerHTML = 'Your driver has arrived'
      return
    }

    var etaInMins = Math.floor(etaInMs / (60 * 1000))
    var etaInSecs =
      etaInMs >= 60000
        ? Math.floor((etaInMs % (etaInMins * 60 * 1000)) / 1000)
        : Math.floor(etaInMs / 1000)
    var etaInMinsAndSecs = etaInMins + 'm ' + etaInSecs + 's'
    eta.innerHTML = 'ETA: ' + etaInMinsAndSecs
  }
}

//  Logic to handle the keypress event for the 'send message to the driver' text field.
//  Send a message to the vehicle over PubNub, which will then send the message back to the dashboard (which will create an info window on the map to display the message).
//  Although we are simulating everything on the client here (so could update the map directly), in practice you would manage vehicles on a server, therefore you would send this information over PubNub.
const txtMessageDriver = document.getElementById('txtMessageDriver')
txtMessageDriver.addEventListener('keypress', function (e) {
  if ((e.keyCode || e.charCode) == 13) {
    var messageToSend = txtMessageDriver.value
    if (messageToSend == '') messageToSend = '\n\n'
    pubnub.publish({
      channel: selectedVehicle,
      message: messageToSend
    })
    txtMessageDriver.value = ''
    actionCompleted({ action: 'Send the Driver a Message', debug: false }) //  Only used for interactive demo
  }
})

const naughtyWords = ["anal"," anus","arse","ass","ballsack","balls","bastard","bitch","biatch","bloody","blowjob","blow job","bollock","bollok","boner","boob","bugger","bum","butt","buttplug","clitoris","cock","coon","crap","cunt","damn","dick","dildo","dyke","fag","feck","fellate","fellatio","felching","fuck","f u c k","fudgepacker","fudge packer","flange","Goddamn","God damn","hell ","homo","jerk","jizz","knobend","knob end","labia","lmao","lmfao","muff","nigger","nigga","penis","piss","poop","prick","pube","pussy","queer","scrotum","sex","shit","s hit","sh1t","slut","smegma","spunk","tit","tosser","turd","twat","vagina","wank","whore","wtf"]

function moderate(input)
{
  var output = input;
  for (var i = 0; i < naughtyWords.length; i++)
  {
    output = output.replaceAll(naughtyWords[i], "***");
  }
  return output;
}

