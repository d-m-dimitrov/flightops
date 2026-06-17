const FlightSchedule = require("../models/FlightSchedule");
const Turnaround = require("../models/Turnaround");

async function generateTurnarounds() {

    try {

        const today = new Date();

        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const jsDay = today.getDay();

        // Sunday=7 вместо 0
        const day = jsDay === 0 ? 7 : jsDay;

        console.log("=================================");
        console.log("TURNAROUND GENERATOR");
        console.log("Date:", today.toISOString());
        console.log("Day:", day);
        console.log("=================================");

        const schedules = await FlightSchedule.find({
            active: true
        });

        console.log(`Schedules found: ${schedules.length}`);

        for (const schedule of schedules) {

            try {

                console.log(
                    `Checking ${schedule.arrivalFlight}/${schedule.departureFlight}`
                );

                if (
                    !schedule.daysOfWeek ||
                    !schedule.daysOfWeek.includes(day)
                ) {

                    console.log(
                        `Skipping ${schedule.arrivalFlight}/${schedule.departureFlight} - not scheduled today`
                    );

                    continue;
                }



                const operatingDate =
today.toISOString()
     .substring(0,10);



const existing =
await Turnaround.findOne({

    scheduleId:
    schedule._id,

    operatingDate:
    operatingDate

});

                if (existing) {

                    console.log(
                        `Already exists: ${schedule.arrivalFlight}/${schedule.departureFlight}`
                    );

                    continue;
                }

                const turnaround = await Turnaround.create({

                    scheduleId: schedule._id,

                    operatingDate: operatingDate,

                    airline: schedule.airline,

                    arrivalFlight: schedule.arrivalFlight,

                    departureFlight: schedule.departureFlight,
                    arrival: {

    sta:
    schedule.sta

},

departure: {

    std:
    schedule.std

},

                    flightNumberDisplay:
                        `${schedule.arrivalFlight}/${schedule.departureFlight}`,

                    flightDate: startOfDay,

                    origin: schedule.origin,

                    destination: schedule.destination,

                    status: "SCHEDULED",

                    readiness: 0,

                    aircraft: {

                        aircraftType:
                            schedule.aircraftType || "",

                        registration: "",

                        stand: ""

                    }

                });

                console.log(
                    `CREATED: ${turnaround.flightNumberDisplay}`
                );

            }
            catch (err) {

                console.error(
                    `Error processing schedule ${schedule._id}:`,
                    err.message
                );

            }

        }

        const totalTurnarounds =
            await Turnaround.countDocuments();

        console.log(
            `Total turnarounds in database: ${totalTurnarounds}`
        );

        console.log("Generator completed.");

    }
    catch (err) {

        console.error(
            "Generator failed:",
            err
        );

    }

}

module.exports = generateTurnarounds;