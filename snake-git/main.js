window.addEventListener("DOMContentLoaded", () => {
    document.title = "Shepu's Snake Game - Professional Edition";

    const canvas = document.getElementById("gameCanvas");
    if (!canvas) {
        console.error("Canvas element #gameCanvas not found.");
        return;
    }

    config.WIDTH = window.innerWidth;
    config.HEIGHT = window.innerHeight;
    canvas.width = config.WIDTH;
    canvas.height = config.HEIGHT;

    const engine = new GameEngine(canvas);

    let lastTime = performance.now();
    function loop(currentTime) {
        if (!engine.running) {
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = "24px sans-serif";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText("Game Exited. Please reload to play again.", canvas.width / 2, canvas.height / 2);
            return;
        }

        const dt = currentTime - lastTime;
        lastTime = currentTime;

        const cappedDt = Math.min(100, dt);

        engine.update(cappedDt);
        engine.draw();

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    window.addEventListener("resize", () => {
        config.WIDTH = window.innerWidth;
        config.HEIGHT = window.innerHeight;
        canvas.width = config.WIDTH;
        canvas.height = config.HEIGHT;

        if (engine.control_manager) {
            engine.control_manager.resize(config.WIDTH, config.HEIGHT);
        }
        
        config.VISION_RADIUS = config.STEP * 6.5;
    });
});
