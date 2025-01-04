(() => {
    const sock = io();
 
    let isLoggedIn = false;
    let username = null;

    sock.on("userStatus", (status) => {
        isLoggedIn = status.loggedIn;
        username = status.username;
        updateNav();
    });

    sock.on("set-cookie", (cookie) => {
        document.cookie = cookie;  // Set Cookie in client-site
        console.log("Cookie", cookie);
    });

    document.querySelector("#checkProgress").addEventListener("click", () => {
        sock.emit("getProgress");
    });

    document.querySelector("#checkProgress_2").addEventListener("click", () => {
        sock.emit("getDictionaryAttackProgress");
    });

    sock.on("bruteForceProgress", (data) => {
        document.querySelector("#progress").textContent = `Progress: ${data.progress}% (Attempts: ${data.attempts}/${data.totalCombinations})`;
        console.log(data);
        document.querySelector("#result").textContent = `Result: ${data.found}`;
    });

    sock.on("dictionaryAttackProgress", (data) => {
        document.querySelector("#progress_2").textContent = `Progress: ${data.progress}% (Attempts: ${data.attempts}/${data.totalCombinations})`;
        console.log(data);
        document.querySelector("#result_2").textContent = `Result: ${data.found}`;
    });

    document.querySelector("#stopBruteForce").addEventListener("click", () => {
        sock.emit("stopBruteForce");
    });

    document.querySelector("#stopDictionaryAttack").addEventListener("click", () => {
        sock.emit("stopDictionaryAttack");
    });

    // Pobierz listę słowników
    sock.emit("getDictionaries");

    sock.on("dictionaryList", (data) => {
        const resultDiv = document.querySelector("#result_2");
        if (data.success) {
            const select = document.querySelector("#form_2_dictionary");
            select.innerHTML = data.dictionaries.map(dict => `<option value="${dict}">${dict}</option>`).join("");
            resultDiv.innerHTML = "Dictionaries loaded successfully.";
        } else {
            resultDiv.innerHTML = `<span class="error">${data.error}</span>`;
        }
    });

    // Rozpocznij atak słownikowy
    document.querySelector("#form_2").addEventListener("submit", (event) => {
        event.preventDefault();
        const hash = document.querySelector("#form_2_hash").value;
        const algorithm = document.querySelector("#form_2_algorithm").value;
        const dictionary = document.querySelector("#form_2_dictionary").value;

        if (!hash || !dictionary) {
            document.querySelector("#result_2").innerHTML = `<span class="error">Please provide a hash and select a dictionary.</span>`;
            return;
        }

        sock.emit("dictionaryAttack", hash, algorithm, dictionary);
        //document.querySelector("#result_2").innerHTML = "Dictionary attack started...";
    });

    // Wynik ataku słownikowego
    sock.on("dictionaryAttackResult", (data) => {
        const resultDiv = document.querySelector("#result_2");
        console.log(data)
        if (data.success) {
            resultDiv.innerHTML = `<span class="success">Password found: ${data.result}</span>`;
        } else {
            resultDiv.innerHTML = `<span class="error">${data.error}</span>`;
        }
    });

    // Upload słownika
    document.querySelector("#uploadDictionaryForm").addEventListener("submit", (event) => {
        event.preventDefault(); // Zapobiegamy przeładowaniu strony

        const fileInput = document.querySelector("#uploadDictionary");
        const file = fileInput.files[0];
        const resultDiv = document.querySelector("#result_2");

        if (!file) {
            resultDiv.innerHTML = `<span class="error">No file selected for upload.</span>`;
            return;
        }

        const reader = new FileReader();
        reader.onload = function () {
            sock.emit("uploadDictionary", file.name, reader.result );
            resultDiv.innerHTML = "Uploading dictionary...";
        };

        reader.readAsText(file);
    });

    sock.on("uploadDictionaryResult", (data) => {
        const resultDiv = document.querySelector("#result_2");
        if (data.success) {
            resultDiv.innerHTML = `<span class="success">${data.message}</span>`;
        } else {
            resultDiv.innerHTML = `<span class="error">${data.error}</span>`;
        }
        sock.emit("getDictionaries");
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
            nav.innerHTML = `<a href="/login.html">Login</a>`;
            logout.style.display = "none";
        }
    };

    document.querySelector("#logout").addEventListener("click", (e) => {
        console.log("logout")
        sock.emit("logout");
        sock.emit("userStatus", { loggedIn: false });
    });

    // Backend responses
    sock.on("bruteForceResult", (result) => {
        if(result.error !== "No active session found."){
            document.querySelector("#result").textContent = `Result: ${JSON.stringify(result)}`;
        }
    });

    /*sock.on("bruteForceTry", (result) => {
        document.querySelector("#try").textContent = `Try: ${JSON.stringify(result)}`;
    });*/


    // Emit events
    document.querySelector("#form_1").addEventListener('submit', (e) => {
        e.preventDefault();
        const hash = document.querySelector("#form_1_hash").value;
        const charset = document.querySelector("#form_1_charset").value;
        const maxLen = document.querySelector("#form_1_maxlen").value;
        const algorithm = document.querySelector("#form_1_algorithm").value;
        sock.emit("bruteForce", hash, charset, maxLen, algorithm);
    });

    // Trigger user status update on load
    sock.emit("checkUserStatus");
    sock.emit("resumeSession");
})();