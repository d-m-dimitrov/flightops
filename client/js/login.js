

async function login(){

    const email =
    document.getElementById(
        "email"
    ).value;

    const password =
    document.getElementById(
        "password"
    ).value;

    const response =
    await fetch(

        "/api/auth/login",

        {

            method:"POST",

            headers:{
                "Content-Type":
                "application/json"
            },

            body:JSON.stringify({

                email,

                password

            })

        }

    );

    if(!response.ok){

        alert(
            "Invalid login"
        );

        return;

    }

    const data =
    await response.json();

    localStorage.setItem(

        "token",

        data.token

    );

    localStorage.setItem(

        "user",

        JSON.stringify(
            data.user
        )

    );

    window.location =
    "flights.html";

}


