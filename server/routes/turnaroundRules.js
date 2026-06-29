const express =
require("express");

const router =
express.Router();

const Rule =
require("../models/TurnaroundRule");

router.get(

    "/",

    async(req,res)=>{

        const rules =

        await Rule

        .find()

        .sort({

            airline:1,

            aircraftType:1

        });

        res.json(
            rules
        );

    }

);

module.exports =
router;