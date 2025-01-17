/*
    Created by Kammar1006
*/

const opt = require('../settings.json');
const PORT = opt.port;
const COOKIE_FLAG = opt.cookie

const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const {queryDatabase} = require('./db.js');
const bcrypt = require("bcrypt");

const app = express();
app.use(express.static(`${__dirname}/../frontend`));

const server = http.createServer(app);
const io = socketio(server, {
	cookie: true,
});

const {isAlnum, isEmail, isLen} = require("./strings_analyzer.js");
const { randomBytes } = require('crypto');

const dictionariesPath = path.join(__dirname, "dictionaries");

let translationTab = [];
let progressData = {};
let activeProcesses = {};
let dictionaryProgressData = {};
let dictionaryActiveProcesses = {};

const setCID = (sock) => {
	//console.log(sock.request.headers.cookie);
	let cid;
	if(sock.handshake.headers.cookie == undefined){
		return false;
	}
	let cookie = (sock.handshake.headers.cookie).split(" ");
	cookie.forEach(element => {
		if(element.split("=")[0]==COOKIE_FLAG) cid = element.split("=")[1];	
	});
	if(cid == undefined || cid == ""){
		return false;
	}
	else{
		if(cid[cid.length-1] == ";"){
			cid = cid.substring(0, cid.length-1);
		}
	}
	return cid;
}
const setTranslationTab = (cid) => {
	if(translationTab[cid]==undefined){
		translationTab[cid]={
			user_id: -1,
			db_stats: {},
			test_counter: 0,
		};
	}
}

const getRole = (cid) => {
    const user = translationTab[cid];
    if (user.user_id === -1) return "anonim";
    if (user.db_stats.is_admin) return "admin";
    return "auth";
};

const permissions = (cid, action) => {
    const role = getRole(cid).toLowerCase();
    const settings = opt[role];

    if (!settings) {
        console.error(`[Permissions] Role ${role} not found in settings.`);
        return false; 
    }

    if (!(action in settings)) {
        console.error(`[Permissions] Action ${action} not found for role ${role}.`);
        return false;
    }

    return settings[action];
};

const hasher = (data) => {
	return bcrypt.hashSync(data, 10);
}
const hashCompare = (data, hash) => {
	return (bcrypt.compareSync(data, hash));
}
const emit_login_data = (sock, db_stats) => {
	let emit_db_stats = {...db_stats};
	sock.emit("login",  "Login successful"); 
	sock.emit("userStatus", { loggedIn: true, username: emit_db_stats.login });
}

io.on('connection', (sock) => {
	let cid = setCID(sock);
	if(!cid){
		cid = randomBytes(30).toString('hex');
		sock.emit("set-cookie", `${COOKIE_FLAG}=${cid}; Path=/; SameSite=None; Secure`);
	}
	setTranslationTab(cid);

	console.log("User: "+cid);

	sock.on("checkUserStatus", () => {
		const user = translationTab[cid];
		if (user && user.user_id !== -1) {
			sock.emit("userStatus", { loggedIn: true, username: user.db_stats.login });
		} else {
			sock.emit("userStatus", { loggedIn: false });
		}
	});

	//login:
	sock.on("login", (login, pass) => {
		if(!(isAlnum(login) && isAlnum(pass))) return;

		queryDatabase("SELECT * FROM users WHERE login =?", [login])
		.then((res) => {
			if(res && res.length == 1){
				if(hashCompare(pass, res[0].password)){
					console.log("Pass OKOK");
					translationTab[cid].user_id = res[0].id;
					translationTab[cid].db_stats = res[0];
					console.log(translationTab[cid]);
					emit_login_data(sock, translationTab[cid].db_stats);
				}
				else{
					console.log("Pass NOTOK");
					sock.emit("login", "Wrong login or password")
				}
			}
			else{
				console.log("Pass NOTOK");
				sock.emit("login", "Wrong login or password")
			}
		}).catch((err) => {
			console.log("DB ERROR: "+err);
		})
			
		
	});

	//register:
	sock.on("register", (login, pass, pass2, email) => {
		console.log("Register:", login, pass, pass2, email);
		
		if(!(isEmail(email))){
			console.log("Email is NOT ok");
			sock.emit("register", "wrong email format");
			return;
		}

		if(!(isLen(login, 4, 20) && isAlnum(login))){
			console.log("Login len ERR");
			sock.emit("register", "wrong login format/length");
			return;
		}

		if(!(isLen(pass, 8, 50) && isAlnum(pass))){
			console.log("Pass len ERR");
			sock.emit("register", "wrong pass format/length");
			return;
		}

		if(pass === pass2){
			console.log("All OK!!");

			queryDatabase("SELECT `login`, `email` FROM `users` WHERE login=? OR email=?", [login, email])
			.then((res) => {
				if(res.length){
					let a=0, b=0;
					res.forEach(e => {
						if(e.email == email) a = 1;
						if(e.login == login) b = 1;
					});
					if(a){
						console.log("Email is in db");
						sock.emit("register", "email in db");
					} 
					if(b){
						console.log("Login is in db");
						sock.emit("register", "login in db");
					} 
				}
				else{
					queryDatabase("INSERT INTO `users` (`id`, `login`, `password`, `email`) VALUES ('', ?, ?, ?)", [login, hasher(pass), email])
					.then(() => {
						sock.emit("register", "register");
					}).catch((err) => {console.log("DB Error: "+err)});
				}
			}).catch((err) => {console.log("DB Error: "+err);});
		}
		else{
			sock.emit("register", "pass != pass2");
		}
	});

	//logout
	sock.on("logout", () => {
		translationTab[cid].db_stats = {};
		translationTab[cid].user_id = -1;
		sock.emit("logout");
		sock.emit("userStatus", { loggedIn: false });
	});

	sock.on("bruteForce", (hash, charset, maxLen, algorithm = "md5") => {
		console.log(hash, charset, maxLen, algorithm);

		const cid = setCID(sock);
		const user = translationTab[cid];

		if (user) {
			if(!permissions(cid, "bruteforce_attack")){
				sock.emit("bruteForceResult", `Your role (${getRole(cid)} user) have no access for bruteforce attack`);
				return;
			}
		}

		if (user) {
			if(maxLen > permissions(cid, "bruteforce_max_len")){
				sock.emit("bruteForceResult", `For ${getRole(cid)} users max bruteforce length is ${permissions(cid, "bruteforce_max_len")}`);
				return;
			}
		}

		if (!["md5", "sha1", "sha256", "sha512", "ripemd160"].includes(algorithm)) {
			algorithm = "md5";
		}

		maxLen = parseInt(maxLen, 10);
		if (isNaN(maxLen) || maxLen < 1) {
			delete activeProcesses[cid];
			sock.emit("bruteForceResult", { success: false, error: "Invalid max length." });
			return;
		}

		if (activeProcesses[cid]) {
			sock.emit("bruteForceResult", { success: false, error: "Wait for earlier bruteforce method result" });
			return;
		}

		activeProcesses[cid] = true;
		progressData[cid] = { progress: 0, attempts: 0, totalCombinations: 0, found: null };

		const crypto = require("crypto");

		sock.emit("bruteForceResult", { success: false, error: "Bruteforce started." });

		const calculateTotalCombinations = (charsetLength, maxLen) => {
			let total = 0;
			for (let k = 1; k <= maxLen; k++) {
				total += Math.pow(charsetLength, k);
			}
			return total;
		};

		async function crackHash(hash, charset, maxLen, algorithm) {
			charset = [...new Set(charset)];
			const charsetLength = charset.length;
			const totalCombinations = calculateTotalCombinations(charsetLength, maxLen);
			let attempts = 0;
			let found = false;

			function* generateCombinations(charset, maxLen) {
				for (let len = 1; len <= maxLen; len++) {
					const indices = Array(len).fill(0);
					while (true) {
						yield indices.map(i => charset[i]).join('');
						let pos = len - 1;
						while (pos >= 0 && indices[pos] === charsetLength - 1) {
							indices[pos] = 0;
							pos--;
						}
						if (pos < 0) break;
						indices[pos]++;
					}
				}
			}

			const combinations = generateCombinations(charset, maxLen);
			let div = totalCombinations > 1e6 ? 10 ** Math.floor(Math.log10(totalCombinations)) / 1e3 : 1000;
			if (div > 100000) div = 100000;

			for (let attempt of combinations) {
				if (!activeProcesses[cid]) break;

				const attemptHash = crypto.createHash(algorithm).update(attempt).digest("hex");
				attempts++;

				if (attempts % div === 0) {
					const progress = ((attempts / totalCombinations) * 100).toFixed(2);
					progressData[cid] = { progress, attempts, totalCombinations, found };
				}

				if (attemptHash === hash) {
					found = attempt;
					sock.emit("bruteForceResult", { success: true, result: attempt });
					const progress = ((attempts / totalCombinations) * 100).toFixed(2);
					sock.emit("bruteForceProgress", { progress: Math.min(progress, 100), attempts, totalCombinations, found });
					break;
				}

				if (attempts % 10000 === 0) {
					await new Promise(resolve => setImmediate(resolve));
				}
			}

			if (!found && activeProcesses[cid]) {
				sock.emit("bruteForceResult", { success: false });
				const progress = ((attempts / totalCombinations) * 100).toFixed(2);
				sock.emit("bruteForceProgress", { progress: Math.min(progress, 100), attempts, totalCombinations, found });
			}

			delete activeProcesses[cid];
			progressData[cid] = { progress: 100, attempts, totalCombinations, found };
		}

		crackHash(hash, charset.split(""), maxLen, algorithm).catch(err => {
			console.error("BruteForce Error:", err);
			sock.emit("bruteForceResult", { success: false, error: "An error occurred during brute-force." });
			delete activeProcesses[cid];
		});
	});

	sock.on("stopBruteForce", () => {
		if (activeProcesses[cid]) {
			delete activeProcesses[cid];
			sock.emit("bruteForceResult", { success: false, error: "Brute-force stopped by user." });
		} else {
			sock.emit("bruteForceResult", { success: false, error: "No active brute-force process to stop." });
		}
	});

	sock.on("stopDictionaryAttack", () => {
		if (dictionaryActiveProcesses[cid]) {
			delete dictionaryActiveProcesses[cid];
			sock.emit("dictionaryAttackResult", { success: false, error: "Dictionary attack stopped by user." });
		} else {
			sock.emit("dictionaryAttackResult", { success: false, error: "No active dictionary attack process to stop." });
		}
	});

	sock.on("getProgress", () => {
		const data = progressData[cid];
		if (data) {
			sock.emit("bruteForceProgress", data);
		} else {
			sock.emit("bruteForceProgress", { progress: 0, attempts: 0, totalCombinations: 0, found: null });
		}
	});

	sock.on("getDictionaryAttackProgress", () => {
		const data = dictionaryProgressData[cid];
		if (data) {
			sock.emit("dictionaryAttackProgress", data);
		} else {
			sock.emit("dictionaryAttackProgress", { progress: 0, attempts: 0, totalCombinations: 0, found: null });
		}
	});

	sock.on("resumeSession", () => {
		const progress = progressData[cid];
		if (progress) {
			sock.emit("bruteForceProgress", progress);
		} else {
			sock.emit("bruteForceResult", { success: false, error: "No active session found." });
		}

		const dictionaryProgress = dictionaryProgressData[cid];
		if (dictionaryProgress) {
			sock.emit("dictionaryAttackProgress", dictionaryProgress);
		} else {
			sock.emit("dictionaryAttackResult", { success: false, error: "No active session found." });
		}
	});

	sock.on("getDictionaries", () => {
		fs.readdir(dictionariesPath, (err, files) => {
			if (err) {
				sock.emit("dictionaryList", { success: false, error: "Unable to read dictionaries." });
				return;
			}
			const dictionaries = files.filter(file => file.endsWith(".txt"));
			sock.emit("dictionaryList", { success: true, dictionaries });
		});
	});

	sock.on("dictionaryAttack", async (hash, algorithm = "md5", dictionaryName) => {
		console.log(`[Dictionary Attack] Start: hash=${hash}, algorithm=${algorithm}, dictionary=${dictionaryName}`);
	
		const user = translationTab[cid];
		if (user) {
			if(!permissions(cid, "dictionary_attack")){
				sock.emit("dictionaryAttackResult", `Your role (${getRole(cid)} user) have no access for dictionary attack`);
				return;
			}
		}

		if (!hash || !dictionaryName) {
			sock.emit("dictionaryAttackResult", { success: false, error: "Invalid parameters." });
			return;
		}
	
		const dictionaryPath = path.join(dictionariesPath, dictionaryName);
		if (!fs.existsSync(dictionaryPath)) {
			sock.emit("dictionaryAttackResult", { success: false, error: "Dictionary not found." });
			return;
		}
	
		if (!["md5", "sha1", "sha256", "sha512", "ripemd160"].includes(algorithm)) {
			algorithm = "md5";
		}

		if (dictionaryActiveProcesses[cid]) {
			sock.emit("dictionaryAttackResult", { success: false, error: "Wait for earlier dictionary attack result" });
			return;
		}
	
		const crypto = require("crypto");
		sock.emit("dictionaryAttackResult", { success: false, error: "Loading Dictionary...." });
		const countLines = async (filePath) => {
			return new Promise((resolve, reject) => {
				let lineCount = 0;
		
				const stream = fs.createReadStream(filePath);
				const rl = readline.createInterface({
					input: stream,
					crlfDelay: Infinity,
				});
		
				rl.on("line", () => {
					lineCount++;
				});
		
				rl.on("close", () => {
					resolve(lineCount);
				});
		
				rl.on("error", (err) => {
					reject(err);
				});
			});
		};
		const totalCombinations = await countLines(dictionaryPath);
		sock.emit("dictionaryAttackResult", { success: false, error: "Dictionary Loaded" });
		let attempts = 0;
		let found = null;

		dictionaryActiveProcesses[cid] = true;
		dictionaryProgressData[cid] = { progress: 0, attempts: 0, totalCombinations, found: null };
	
		const updateProgress = () => {
			const progress = ((attempts / totalCombinations) * 100).toFixed(2);
			dictionaryProgressData[cid] = { progress, attempts, totalCombinations, found };
			sock.emit("dictionaryProgress", dictionaryProgressData[cid]);
			//console.log(`[Progress] CID: ${cid}, Progress: ${progress}%, Attempts: ${attempts}/${totalCombinations}`);
		};

		let buffer = "";
	
		const processChunk = async (chunk) => {
			const lines = chunk.split("\n");

			for (const password of lines) {
				if (!dictionaryActiveProcesses[cid] || found) break;
	
				attempts++;
				const attemptHash = crypto.createHash(algorithm).update(password.trim()).digest("hex");
				if (attemptHash === hash) {
					found = password.trim();
					break;
				}
	
				if (attempts % 100 === 0) {
					updateProgress();
					await new Promise(resolve => setImmediate(resolve)); // Prevent blocking
				}
			}
		};
	
		try {
			const stream = fs.createReadStream(dictionaryPath, { encoding: "utf-8", highWaterMark: 16 * 1024 });
	
			stream.on("data", async (chunk) => {
				//console.log(`[Dictionary Attack] Processing chunk of size: ${chunk.length}`);
				if (!dictionaryActiveProcesses[cid]) {
					//console.log(`[Dictionary Attack] CID: ${cid}, Stopped by user.`);
					stream.destroy();
					return;
				}
				await processChunk(chunk);
				if (found) {
					//console.log(`[Dictionary Attack] CID: ${cid}, Password found.`);
					stream.destroy();
				}
			});
			
			stream.on("end", () => {
				//console.log(`[Dictionary Attack] CID: ${cid}, Stream ended.`);
				if (!found) {
					sock.emit("dictionaryAttackResult", { success: false, error: "Password not found in dictionary." });
				}
				finalizeAttack();
			});
			
			stream.on("close", () => {
				console.log(`[Dictionary Attack] CID: ${cid}, Stream closed.`);
				if (found) {
					sock.emit("dictionaryAttackResult", { success: true, result: found });
				} else {
					sock.emit("dictionaryAttackResult", { success: false, error: "Password not found in dictionary." });
				}
				finalizeAttack();
			});
			
			function finalizeAttack() {
				dictionaryProgressData[cid] = { progress: 100, attempts, totalCombinations, found };
				delete dictionaryActiveProcesses[cid];
			}
	
			stream.on("error", (err) => {
				console.error(`[Dictionary Attack] CID: ${cid}, Stream error:`, err);
				sock.emit("dictionaryAttackResult", { success: false, error: "Error reading dictionary." });
				delete dictionaryActiveProcesses[cid];
			});
		} catch (err) {
			console.error(`[Dictionary Attack] CID: ${cid}, Error:`, err);
			sock.emit("dictionaryAttackResult", { success: false, error: "Unexpected error during attack." });
			delete dictionaryActiveProcesses[cid];
		}
	});

	sock.on("uploadDictionary", (fileName, fileContent) => {
		if (!permissions(cid, "dictionary_upload")) {
			sock.emit("uploadDictionaryResult", { success: false, error: "Only admins can upload dictionaries." });
			return;
		}

		if (typeof fileName !== "string" || typeof fileContent !== "string") {
			console.log(typeof fileName);
			console.log(typeof fileContent);
			sock.emit("uploadDictionaryResult", { success: false, error: "Invalid file name or content." });
			return;
		}

		if (typeof dictionariesPath !== "string") {
			console.error("[Upload Dictionary] Invalid dictionariesPath:", dictionariesPath);
			sock.emit("uploadDictionaryResult", { success: false, error: "Invalid dictionaries path configuration." });
			return;
		}

		const filePath = path.join(dictionariesPath, fileName);

		fs.writeFile(filePath, fileContent, (err) => {
			if (err) {
				console.error("[Upload Dictionary] Failed to write file:", err);
				sock.emit("uploadDictionaryResult", { success: false, error: "Failed to save dictionary." });
				return;
			}
			sock.emit("uploadDictionaryResult", { success: true, message: "Dictionary uploaded successfully." });
		});
	});

});

server.listen(PORT, () => {
	console.log("Work");
});