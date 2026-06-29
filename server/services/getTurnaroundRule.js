const Rule =
require("../models/TurnaroundRule");

module.exports =
async function(

    airline,

    aircraftType

){

    return await Rule.findOne({

        airline,

        aircraftType

    });

}