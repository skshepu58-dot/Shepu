function is_android() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes("android") || ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod") || (window.hasOwnProperty && window.hasOwnProperty("Android")) || !!window.cordova;
}

function get_android_display_size() {
    return [window.innerWidth, window.innerHeight];
}

function resource_path(relative_path) {
    return relative_path;
}

function parse_game_data_text(text) {
    const lines = text.split("\n");
    const data = {
        level: 1,
        lifetime_score: 0,
        high_scores: { "Classic": 0, "Time Attack": 0, "No Wall": 0 },
        current_skin: "classic",
        game_mode: "Classic",
        movement_style: "Robotic",
        fps: 10,
        step: 30,
        music_volume: 0.5,
        sound_volume: 0.5,
        music_index: 0,
        bg_index: 0,
        bg_effect: true,
        player_name: "",
        control_mode: "swipe",
        control_setup_done: false,
        joystick_side: "right",
        swipe_tutorial_shown: false,
    };
    
    for (const line of lines) {
        const parts = line.trim().split(":");
        if (parts.length === 2) {
            const key = parts[0];
            const value = parts[1];
            if (["level", "lifetime_score", "fps", "step", "music_index", "bg_index"].includes(key)) {
                data[key] = parseInt(value) || 0;
            } else if (["music_volume", "sound_volume"].includes(key)) {
                data[key] = parseFloat(value) || 0;
            } else if (key === "bg_effect" || key === "control_setup_done" || key === "swipe_tutorial_shown") {
                data[key] = value.toLowerCase() === "true";
            } else if (["current_skin", "game_mode", "movement_style", "player_name", "control_mode", "joystick_side"].includes(key)) {
                data[key] = value;
            } else if (data.high_scores.hasOwnProperty(key)) {
                data.high_scores[key] = parseInt(value) || 0;
            }
        }
    }
    return data;
}

function export_data_to_file(data) {
    let content = `level:${data.level}\n`;
    content += `lifetime_score:${data.lifetime_score}\n`;
    content += `current_skin:${data.current_skin}\n`;
    content += `game_mode:${data.game_mode}\n`;
    content += `movement_style:${data.movement_style || 'Robotic'}\n`;
    content += `fps:${data.fps}\n`;
    content += `step:${data.step}\n`;
    content += `music_volume:${data.music_volume}\n`;
    content += `sound_volume:${data.sound_volume}\n`;
    content += `music_index:${data.music_index || 0}\n`;
    content += `bg_index:${data.bg_index || 0}\n`;
    content += `bg_effect:${data.bg_effect ? 'True' : 'False'}\n`;
    content += `player_name:${data.player_name || ''}\n`;
    content += `control_mode:${data.control_mode || 'swipe'}\n`;
    content += `control_setup_done:${data.control_setup_done ? 'True' : 'False'}\n`;
    content += `joystick_side:${data.joystick_side || 'right'}\n`;
    content += `swipe_tutorial_shown:${data.swipe_tutorial_shown ? 'True' : 'False'}\n`;
    if (data.high_scores) {
        for (const [mode, score] of Object.entries(data.high_scores)) {
            content += `${mode}:${score}\n`;
        }
    }
    
    // Copy to clipboard fallback for mobile WebView compatibility
    try {
        navigator.clipboard.writeText(content).then(() => {
            alert("Game data copied to clipboard! You can paste and save it as text.\n\nগেম ডাটা ক্লিপবোর্ডে কপি করা হয়েছে! আপনি এটি পেস্ট করে সংরক্ষণ করতে পারেন।");
        }).catch(() => {
            prompt("Copy your game data below / নিচের ডাটাটি কপি করুন:", content);
        });
    } catch(err) {
        prompt("Copy your game data below / নিচের ডাটাটি কপি করুন:", content);
    }

    try {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "game_data.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Failed to export game data", e);
    }
}

function import_data_from_file(callback) {
    const choose = confirm("Press OK to upload a game_data.txt file, or Cancel to paste data text directly.\n\nফাইল আপলোড করতে OK চাপুন, অথবা সরাসরি ডাটা পেস্ট করতে Cancel চাপুন।");
    if (!choose) {
        const pasted = prompt("Paste your game data text here / আপনার গেম ডাটা এখানে পেস্ট করুন:");
        if (pasted) {
            const parsed = parse_game_data_text(pasted);
            if (parsed) {
                callback(parsed);
            } else {
                alert("Invalid data format! / ডাটার ফরম্যাট সঠিক নয়।");
            }
        }
        return;
    }

    try {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".txt";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target.result;
                const parsed = parse_game_data_text(text);
                if (parsed) {
                    callback(parsed);
                }
            }
            reader.readAsText(file);
        };
        input.click();
    } catch (e) {
        console.error("Failed to import game data", e);
    }
}

class DataManager {
    constructor(filename = "shepu_snake_game_data") {
        this.key = filename;
    }

    load_data() {
        const defaultData = {
            level: 1,
            lifetime_score: 0,
            high_scores: { "Classic": 0, "Time Attack": 0, "No Wall": 0 },
            current_skin: "classic",
            game_mode: "Classic",
            movement_style: "Robotic",
            fps: 10,
            step: 30,
            music_volume: 0.5,
            sound_volume: 0.5,
            music_index: 0,
            bg_index: 0,
            bg_effect: true,
            player_name: "",
            control_mode: config.DEFAULT_CONTROL_MODE,
            control_setup_done: false,
            joystick_side: config.DEFAULT_JOYSTICK_SIDE,
            swipe_tutorial_shown: false,
        };

        try {
            const raw = localStorage.getItem(this.key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.high_scores) {
                    parsed.high_scores = { ...defaultData.high_scores, ...parsed.high_scores };
                }
                return { ...defaultData, ...parsed };
            }
        } catch (e) {
            console.warn("Could not load data from localStorage, using defaults", e);
        }
        return defaultData;
    }

    save_data(data) {
        try {
            localStorage.setItem(this.key, JSON.stringify(data));
        } catch (e) {
            console.warn("Could not save data to localStorage", e);
        }
    }
}
