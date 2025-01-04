(() => {
    const sock = io();

    let isLoggedIn = false;
    let username = null;

    sock.on("userStatus", (status) => {
        
        isLoggedIn = status.loggedIn;
        if(isLoggedIn) window.location = "/";
        username = status.username;
        updateNav();
    });

    sock.on("set-cookie", (cookie) => {
        document.cookie = cookie;  // Set Cookie in client-site
        console.log("Cookie", cookie);
    });

    const updateNav = () => {
        const nav = document.querySelector("#user-status");
        const logout = document.querySelector("#logout");
        if (isLoggedIn) {
            nav.innerHTML = `
                Login as: ${username}
            `;
            logout.style.display = "block";
        } else {
            nav.innerHTML = `<a href="/login.html">Not Login</a>`;
            logout.style.display = "none";
        }
    };

    document.querySelector("#logout").addEventListener("click", (e) => {
        sock.emit("logout");
        sock.emit("checkUserStatus");
    });

    sock.on("login", (e) => {
        document.querySelector("#login_info").textContent = `Login status: ${e}`;
    });

    sock.on("register", (e) => {
        document.querySelector("#register_info").textContent = `Register status: ${e}`;
    });

    document.querySelector("#form_2").addEventListener('submit', (e) => {
        e.preventDefault();
        const login = document.querySelector("#form_2_login").value;
        const pass = document.querySelector("#form_2_pass").value;
        sock.emit("login", login, pass);
    });

    document.querySelector("#form_3").addEventListener('submit', (e) => {
        e.preventDefault();
        const login = document.querySelector("#form_3_login").value;
        const pass = document.querySelector("#form_3_pass").value;
        const pass2 = document.querySelector("#form_3_pass2").value;
        const email = document.querySelector("#form_3_email").value;
        sock.emit("register", login, pass, pass2, email);
    });

    sock.emit("checkUserStatus");

})();