const Event = require("../models/Event");
const EventDefinition = require("../models/EventDefinition");

async function calculateReadiness(
    turnaroundId
){

    const definitions =
    await EventDefinition.find({
        active:true
    });

    const events =
    await Event.find({
        turnaroundId
    });

    const completed =
    events.map(
        e => e.eventType
    );

    let maxPoints = 0;
    let earnedPoints = 0;

    definitions.forEach(def => {

        maxPoints +=
        def.readinessPoints;

        if(
            completed.includes(
                def.code
            )
        ){

            earnedPoints +=
            def.readinessPoints;

        }

    });

    const percentage =
    maxPoints === 0
    ? 0
    : Math.round(
        earnedPoints
        /
        maxPoints
        * 100
    );


    console.log("Completed:", completed);
    console.log("Earned:", earnedPoints);
    console.log("Max:", maxPoints);
    console.log("Percentage:", percentage);

    return {

        percentage,

        earnedPoints,

        maxPoints

    };

}

module.exports =
calculateReadiness;