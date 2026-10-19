function checkAuth(){

    const token =
    localStorage.getItem(
        "token"
    );

    if(!token){

        window.location =
        "login.html";

        return false;
    }

    return true;
}

function logout(){

    localStorage.clear();

    window.location =
    "login.html";

}


function getCurrentUser(){

    return JSON.parse(

        localStorage.getItem(
            "user"
        )

    );

}


function applyRolePermissions(){

    const user =
    getCurrentUser();

    if(!user){
        return;
    }

    if(user.role !== "ADMIN"){

        document
        .querySelector(
            'a[href="staff.html"]'
        )
        ?.remove();

    }

}

function canEdit(module){

    const user =
    getCurrentUser();

    if(!user){
        return false;
    }

    const skills =
    user.skills || [];

    const position =
    user.position || "";

    const permissions = {

        PASSENGERS:[
            "CHECKIN",
            "GATE",
            "ARRIVAL"
        ],

        SPECIAL_HANDLING:[
            "CHECKIN",
            "GATE",
            "ARRIVAL"
        ],

        FLIGHT_DETAILS:[
            "ARRIVAL_DISPATCH",
            "DISPATCH"
        ],

        ASSIGNMENTS:[]
    };
if(user.role === "ADMIN") return true;
if(
    [
        "OPERATIONS_DM",
        "PAX_DM",
        "RAMP_DM",
        "SPUR_DM"
    ].includes(position)
){
    return true;
}

    if(module === "ASSIGNMENTS"){

        return [

            "TRAFFIC_COORDINATOR",
            "CHECKIN_SUPERVISOR",
            "RAMP_ALLOCATOR",
            "SPUR_COORDINATOR"

        ].includes(
            position
        );

    }

    return permissions[module]
    ?.some(

        skill =>

        skills.includes(
            skill
        )

    );

}




function showCurrentUser(){

    const user =
    JSON.parse(
        localStorage.getItem(
            "user"
        )
    );

    if(!user){
        return;
    }

    const panel =
    document.getElementById(
        "currentUserInfo"
    );

    if(!panel){
        return;
    }

panel.innerHTML = `

    👤 ${user.name}

    <span
        class="badge ms-2 bg-primary">

        ${user.role === "ADMIN" ? "Super Admin" : user.position || "-"}

    </span>

`;
}

function applyMenuPermissions(){

    const user =
    getCurrentUser();

    if(!user){
        return;
    }

    const controlPositions = {
        OPERATIONS:['OPERATIONS_DM','TRAFFIC_COORDINATOR'],
        PASSENGER_HANDLING:['PAX_DM','CHECKIN_SUPERVISOR'],
        RAMP:['RAMP_DM','RAMP_ALLOCATOR'], SPUR:['SPUR_DM','SPUR_COORDINATOR']
    };
    if (user.role !== 'ADMIN' && !controlPositions[user.department]?.includes(user.position)) {
        document.getElementById('menuControl')?.remove();
    }
    const canManage =

        user.role === "ADMIN"
        ||

        [
            "OPERATIONS_DM",
            "PAX_DM",
            "RAMP_DM",
            "SPUR_DM"
        ].includes(
            user.position
        );

    const schedulesMenu =
    document.getElementById(
        "menuSchedules"
    );

    const staffMenu =
    document.getElementById(
        "menuStaff"
    );

    if(
        schedulesMenu &&
        !canManage
    ){
        schedulesMenu.remove();
    }

    if(
        staffMenu &&
        !canManage
    ){
        staffMenu.remove();
    }

}

function setupFlightOpsNavigation(){
    const current=getCurrentUser();
    if(!current || !localStorage.getItem('token'))return;
    const admin=current.role==='ADMIN';
    const manager=admin||['OPERATIONS_DM','PAX_DM','RAMP_DM','SPUR_DM'].includes(current.position);
    const control=admin||({OPERATIONS:['OPERATIONS_DM','TRAFFIC_COORDINATOR'],PASSENGER_HANDLING:['PAX_DM','CHECKIN_SUPERVISOR'],RAMP:['RAMP_DM','RAMP_ALLOCATOR'],SPUR:['SPUR_DM','SPUR_COORDINATOR']}[current.department]||[]).includes(current.position);
    const navbar=document.querySelector('nav.navbar');
    const host=navbar||document.createElement('nav');
    if(!navbar){host.className='flightops-compact-nav';document.body.insertBefore(host,document.body.firstChild);}
    host.classList.add('flightops-navigation');
    if(navbar){host.classList.remove('fixed-top');host.style.position='relative';document.body.style.paddingTop='0';}
    host.replaceChildren();
    const container=document.createElement('div');container.className='flightops-navigation-inner';
    const brand=document.createElement('a');brand.href='flights.html';brand.textContent='FlightOps';brand.style.cssText='color:white;font-weight:700;text-decoration:none;font-size:1.15rem';container.append(brand);
    const links=document.createElement('div');links.className='flightops-navigation-links';
    const addLink=(label,href)=>{const a=document.createElement('a');a.href=href;a.textContent=label;a.style.cssText='color:#e9ecef;text-decoration:none';if(location.pathname.endsWith('/'+href))a.style.fontWeight='bold';links.append(a);};
    addLink('Operations','flights.html');
    addLink('My Flights','my-flights.html');
    if(control)addLink('Control','control.html');
    if(manager)addLink('Schedules','schedules.html');
    if(manager)addLink('Employees','staff.html');
    if(manager)addLink('Roster','staff-roster.html');
    if(manager||control)addLink('Statistics','statistics.html');
    addLink('About','about.html');
    container.append(links);
    const dropdown=(label,entries)=>{
        const details=document.createElement('details');details.className='flightops-navigation-dropdown';
        const summary=document.createElement('summary');summary.textContent=label;summary.className='flightops-navigation-summary';
        const menu=document.createElement('div');menu.className='flightops-navigation-menu';
        for(const [text,href,action] of entries){const item=document.createElement('a');item.href=href||'#';item.textContent=text;item.className='flightops-navigation-menu-item';if(action)item.addEventListener('click',event=>{event.preventDefault();action();});menu.append(item);}
        details.append(summary,menu);document.addEventListener('click',event=>{if(!details.contains(event.target))details.open=false;});return details;
    };
    if(admin)container.append(dropdown('Administration ▾',[['Employees','staff.html'],['User Accounts','user-accounts.html'],['Audit Log','user-accounts.html#audit'],['Handling Instructions','handling-instructions.html']]));
    container.append(dropdown((current.name||'My Account')+' ▾',[['My Profile','my-account.html'],['Change Password','my-account.html#change-password'],['Logout',null,logout]]));
    host.append(container);
}
document.addEventListener('DOMContentLoaded',setupFlightOpsNavigation);


function canCreateFlight(){

    const user =
    getCurrentUser();

    if(!user){
        return false;
    }

    return [

        "OPERATIONS_DM",
        "TRAFFIC_COORDINATOR"

    ].includes(
        user.position
    );

}