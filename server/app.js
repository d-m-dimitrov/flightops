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

connectDB();

const seedEvents =
require("./seed/eventDefinitions");

const seedRoles =
require("./seed/roleDefinitions");

connectDB().then(async () => {

    await seedRoles();

    await seedEvents();

    await generateTurnarounds();

});

generateTurnarounds();

app.use(cors());
app.use(express.json());



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


app.use(
    "/api/users",
    userRoutes
);




app.use(
    "/api/chat",
    require("./routes/chat")
);

app.use(
    "/api/auth",
    require("./routes/auth")
);

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

server.listen(
    PORT,
    ()=>{

        console.log(
            `Server running on port ${PORT}`
        );

    }
);
