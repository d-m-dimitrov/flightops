require("dotenv").config();

const express = require("express");
const http =
require("http");

const { Server } =
require("socket.io");
const cors = require("cors");

const connectDB = require("./config/db");

const eventRoutes = require("./routes/events");
const scheduleRoutes = require("./routes/schedules");
const path = require("path");

const flightRoutes = require("./routes/flights");

const generateTurnarounds = require("./services/turnaroundGenerator");
const eventDefinitionRoutes = require("./routes/eventDefinitions");
const roleDefinitionRoutes = require("./routes/roleDefinitions");

const assignmentRoutes = require("./routes/assignments");


const userRoutes = require("./routes/users");
const userRoleRoutes = require("./routes/userRoles");

const turnaroundRuleRoutes = require("./routes/turnaroundRules");


const app = express();
const server =
http.createServer(app);

const io =
new Server(server,{

    cors:{
        origin:"*"
    }

});

app.set(
    "io",
    io
);

const seedEvents =
require("./seed/eventDefinitions");

const seedRoles =
require("./seed/roleDefinitions");

async function startGenerator() {
    await connectDB();
    await require("./services/bootstrapSuperAdmin")();
    await seedRoles();
    await seedEvents();
    await require("./services/ensureTurnaroundIndex")(require("./models/Turnaround"));
    await require("./models/Lir").init();
    await require("./models/Handover").init();
    await require("./models/GateItems").init();
    await require("./models/ChatReadState").init();
    await require("./models/StaffShift").init();
    await require("./models/RosterCycle").init();
    await require("./models/RosterDraft").init();
    await require("./models/FlightMessage").init();
    await generateTurnarounds();
    // Schedule the next run after completion, avoiding overlapping async intervals.
    const run = async () => {
        try { await generateTurnarounds(); }
        catch (error) { console.error("Turnaround generation failed", error); }
        setTimeout(run, 60000).unref();
    };
    setTimeout(run, 60000).unref();
}

app.use(cors());
app.use("/api/lir", require("./routes/lir"));
app.use(express.json());
app.use("/api/flight-messages", require("./routes/flightMessages"));
app.use("/api/gate-items", require("./routes/gateItems"));
app.use("/api/shifts", require("./routes/shifts"));
app.use("/api/roster-planning", require("./routes/rosterPlanning"));
app.use("/api/control", require("./routes/control"));
app.use("/api/my-flights", require("./routes/myFlights"));
app.use("/api/handovers", require("./routes/handovers"));
app.use("/api/acknowledgements", require("./routes/acknowledgements"));



app.use("/api/events", eventRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/flights", flightRoutes);

app.get("/", (req, res) => {

    res.sendFile(

        path.join(
            __dirname,
            "../client/login.html"
        )

    );

});

app.use(
    express.static(
        path.join(__dirname, "../client")
    )
);

app.use(
    "/api/event-definitions",
    eventDefinitionRoutes
);

app.use(
    "/api/role-definitions",
    roleDefinitionRoutes
);
app.use(
    "/api/assignments",
    assignmentRoutes
);


app.use("/api/statistics/workload", require("./routes/workloadStatistics"));
app.use("/api/user-accounts", require("./routes/userAccounts"));
app.use("/api/handling-instructions", require("./routes/handlingInstructions"));
app.use(
    "/api/users",
    userRoutes
);

app.use(

    "/api/turnaround-rules",

    turnaroundRuleRoutes

);


app.use(
    "/api/chat",
    require("./routes/chat")
);

app.use(
    "/api/auth",
    require("./routes/auth")
);

require("./services/lirLive").attach(io);

io.on(
    "connection",
    socket=>{

        console.log(
            "Socket connected"
        );

        socket.on(
            "joinFlight",
            flightId=>{

                socket.join(
                    flightId
                );

                console.log(
                    `Joined ${flightId}`
                );

            }
        );

    }
);


const PORT = process.env.PORT || 3000;

startGenerator().then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(async error => {
    console.error("Startup failed; check database and duplicate schedule/date records", error);
    await require("mongoose").disconnect();
    process.exitCode = 1;
});
