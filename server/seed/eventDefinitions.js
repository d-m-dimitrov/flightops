const EventDefinition =
require("../models/EventDefinition");

async function seedEvents(){

    const events = [

        // ARRIVAL

        {
            code:"LANDED",
            name:"Landed",
            group:"ARRIVAL",
            roles:["DISPATCH"]
        },

        {
            code:"ON_BLOCKS",
            name:"On Blocks",
            group:"ARRIVAL",
            roles:["DISPATCH"],
            readinessPoints:5
        },

        {
            code:"FIRST_PAX_OFF",
            name:"First Passenger Off",
            group:"ARRIVAL",
            roles:["ARRIVAL"]
        },

        {
            code:"LAST_PAX_OFF",
            name:"Last Passenger Off",
            group:"ARRIVAL",
            roles:["ARRIVAL"],
            readinessPoints:10
        },

        {
            code:"LAST_BAG",
            name:"Last Bag Delivered",
            group:"ARRIVAL",
            roles:["RAMP"]
        },

        {
            code:"UNLOADING_COMPLETE",
            name:"Unloading Complete",
            group:"ARRIVAL",
            roles:["RAMP"],
            readinessPoints:10
        },

        // TURNAROUND

        {
            code:"CLEANING_COMPLETE",
            name:"Cleaning Complete",
            group:"TURNAROUND",
            roles:["DISPATCH"],
            readinessPoints:10
        },

        {
            code:"FUELLING_COMPLETE",
            name:"Fuelling Complete",
            group:"TURNAROUND",
            roles:["DISPATCH"],
            readinessPoints:15
        },

        {
            code:"LOADSHEET_SENT",
            name:"Loadsheet Sent",
            group:"TURNAROUND",
            roles:["DISPATCH"],
            readinessPoints:20
        },

        // DEPARTURE

        {
            code:"CHECKIN_OPEN",
            name:"Check-In Open",
            group:"DEPARTURE",
            roles:["CHECKIN"]
        },

        {
            code:"CHECKIN_CLOSE",
            name:"Check-In Close",
            group:"DEPARTURE",
            roles:["CHECKIN"]
        },

        {
            code:"BOARDING_START",
            name:"Boarding Started",
            group:"DEPARTURE",
            roles:["GATE"]
        },

        {
            code:"FINAL_CALL",
            name:"Final Call",
            group:"DEPARTURE",
            roles:["GATE"]
        },

        {
            code:"BOARDING_COMPLETE",
            name:"Boarding Complete",
            group:"DEPARTURE",
            roles:["GATE"],
            readinessPoints:20
        },

        {
            code:"DOORS_CLOSED",
            name:"Passenger Door Closed",
            group:"DEPARTURE",
            roles:["GATE"],
            readinessPoints:10
        },

        {
            code:"LOADING_COMPLETE",
            name:"Loading Complete",
            group:"DEPARTURE",
            roles:["RAMP"],
            readinessPoints:15
        },

        {
            code:"PUSHBACK",
            name:"Pushback",
            group:"DEPARTURE",
            roles:["RAMP"],
            readinessPoints:5
        },

        {
            code:"AIRBORNE",
            name:"Airborne",
            group:"DEPARTURE",
            roles:["DISPATCH"]
        }

    ];

    for(const event of events){

        const existing =
        await EventDefinition.findOne({
            code:event.code
        });

        if(!existing){

            await EventDefinition.create(
                event
            );

            console.log(
                `Created ${event.code}`
            );

        }

    }

}

module.exports =
seedEvents;