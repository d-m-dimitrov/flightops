const Turnaround =
require("../models/Turnaround");

const calculateReadiness =
require("./readinessCalculator");


const {
    addSystemMessage
} = require(
    "./chatService"
);

async function processEvent(
    turnaroundId,
    eventType,
    eventTime
) {

    const turnaround =
    await Turnaround.findById(
        turnaroundId
    );

    if (!turnaround) {
        return;
    }

    switch(eventType){

        // ARRIVAL

        case "LANDED":

            turnaround.arrival.ata =
            eventTime;

            turnaround.status =
            "ARRIVING";

            break;

        case "ON_BLOCKS":

            turnaround.arrival.onBlocks =
            eventTime;

            turnaround.status =
            "TURNAROUND";

            await addSystemMessage(turnaround._id, "Aircraft On Blocks", "ON_BLOCKS");

            break;

        case "FIRST_PAX_OFF":

            turnaround.arrival.firstPaxOff =
            eventTime;

            break;

        case "LAST_PAX_OFF":

            turnaround.arrival.lastPaxOff =
            eventTime;
await addSystemMessage(turnaround._id, "All Passengers Cleared", "LAST_PAX_OFF");
            break;

        case "FIRST_BAG":

            turnaround.arrival.firstBag =
            eventTime;

            break;

        case "LAST_BAG":

            turnaround.arrival.lastBag =
            eventTime;

            break;

        // CHECK-IN

        case "CHECKIN_OPEN":

            turnaround.departure.checkinOpen =
            eventTime;

            turnaround.status =
            "CHECKIN";
await addSystemMessage(turnaround._id, "Check-in Open", "CHECKIN");
            break;

        case "CHECKIN_CLOSE":

            turnaround.departure.checkinClose =
            eventTime;
await addSystemMessage(turnaround._id, "Check-in Closed", "CHECKIN_CLOSE");
            break;

        // BOARDING

        case "BOARDING_START":

            turnaround.departure.boardingStart =
            eventTime;

            turnaround.status =
            "BOARDING";
await addSystemMessage(turnaround._id, "Start Boarding", "BOARDING");
            break;

        case "BOARDING_COMPLETE":

            turnaround.departure.boardingComplete =
            eventTime;
await addSystemMessage(turnaround._id, "Boarding Complete", "BOARDING_COMPLETE");
            break;

        // RAMP

        case "LOAD_COMPLETE":

            turnaround.departure.loadComplete =
            eventTime;
await addSystemMessage(turnaround._id, "Loading Complete", "LOAD_COMPLETE");
            break;

        case "DOORS_CLOSED":

            turnaround.departure.doorsClosed =
            eventTime;
await addSystemMessage(turnaround._id, "Last Passenger Door Cosed", "DOORS_CLOSED");
            turnaround.status =
            "READY";

            break;

        case "PUSHBACK":

            turnaround.departure.pushback =
            eventTime;
await addSystemMessage(turnaround._id, "Aircraft Pushed", "PUSHBACK");
            turnaround.status =
            "PUSHBACK";

            break;

        case "AIRBORNE":

            turnaround.departure.airborne =
            eventTime;

            turnaround.departure.atd =
            eventTime;

            turnaround.status =
            "DEPARTED";

            break;

    }



    const readiness =
await calculateReadiness(
    turnaround._id
);
console.log("Readiness result:", readiness);
turnaround.readiness =
readiness.percentage;


    await turnaround.save();

}

module.exports = processEvent;