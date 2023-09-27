class Utility {
    static async delay(ms) {
        function _delay(resolve) {
            setTimeout(() => {
                resolve();
            }, ms)
        }

        await new Promise(_delay);
    }
}

class Solver {
    board

    constructor(width, height) {
        this.board = new Board(width, height)
    }

    attach_hint(hint) {
        const { board } = this
        board.attach_hint(hint)
    }

    async solve() {
        const { board } = this
        await board.solve()
    }

    get_result() {
        const { board } = this
        return JSON.parse(JSON.stringify(board.board))
    }

    static make_hint_from_array(arr) {
        const [WIDTH, HEIGHT] = [arr[0].length, arr.length]

        const retval = [[], []]

        for (let i = 0; i < HEIGHT; i++) {
            const params = []

            let cnt = 0
            for (let j = 0; j <= WIDTH; j++) {
                if (j == WIDTH || arr[i][j] != 1) {
                    if (!cnt)
                        continue

                    params.push(cnt)
                    cnt = 0
                }
                else
                    cnt++
            }

            retval[0].push(params)
        }

        for (let j = 0; j < WIDTH; j++) {
            const params = []

            let cnt = 0
            for (let i = 0; i <= HEIGHT; i++) {
                if (i == HEIGHT || arr[i][j] != 1) {
                    if (!cnt)
                        continue

                    params.push(cnt)
                    cnt = 0
                }
                else
                    cnt++
            }

            retval[1].push(params)
        }

        return retval
    }
}

class Board {
    width
    height
    board
    hint
    change_listener

    constructor(width, height) {
        this.width = width
        this.height = height
        this.board = Array.from({ length: this.height }, () =>
            Array.from({ length: this.width }, () => 0)
        )

        this.hint = [
            Array.from({ length: height }, () => []),
            Array.from({ length: width }, () => []),
        ]

        this.change_listener = (_) => { };
    }

    attach_hint(hint) {
        this.hint = hint
    }

    solve_line(hint, board) {
        const { max } = Math;
        const N = board.length;
        const M = hint.length;
        
        const result = Array.from({ length: 2 }, () =>
            new Array(N).fill(0)
        );

        const psum = Array.from({ length: 2 }, () =>
            new Array(N + 1).fill(0)
        );

        for (let i = 0; i < N; i++)
            psum[1][i + 1] = psum[1][i] + (board[i] == 1 ? 1 : 0);
        for (let i = 0; i < N; i++)
            psum[0][i + 1] = psum[0][i] + (board[i] == 2 ? 1 : 0);

        const idxs = Array.from({ length: M + 1 }, () => [0, 0]);

        idxs[0][0] = 0;
        for (let i = 1; i <= M; i++)
            idxs[i][0] = idxs[i - 1][0] + hint[i - 1] + 1;

        idxs[M][1] = N + 1;
        for (let i = M - 1; i >= 0; i--)
            idxs[i][1] = idxs[i + 1][1] - hint[i] - 1;
        
        const margin = (M ? idxs[0][1] : N);
        if (margin < 0)
            return new Array(N).fill(-1);

        const dp = Array.from({length: M + 1}, ()=> 
            new Array(margin + 1).fill(-1)
        );

        function solve_line_dfs(idx, start) {
            if (dp[idx][start - idxs[idx][0]] != -1)
                return dp[idx][start - idxs[idx][0]];

            if (idx == M) {
                if (start <= N && (psum[1][N] - psum[1][start]))
                    return dp[idx][start - idxs[idx][0]] = false;
                if (start < N)
                    result[0][start]++;
                return dp[idx][start - idxs[idx][0]] = true;
            }

            const h = hint[idx];
            let retval = false;

            for (let i = max(idxs[idx][0], start); i <= idxs[idx][1]; i++) {
                if (psum[1][i] - psum[1][start])
                    continue;
                if (psum[0][i + h] - psum[0][i])
                    continue;
                if (i + h + 1 <= N && psum[1][i + h + 1] - psum[1][i + h])
                    continue;

                if (!solve_line_dfs(idx + 1, i + h + 1))
                    continue;

                result[0][start]++;
                result[0][i]--;

                result[1][i]++;
                if (i + h < N)
                    result[1][i + h]--;

                if (i + h < N)
                    result[0][i + h]++;
                if (i + h + 1 < N)
                    result[0][i + h + 1]--;
                retval = true;
            }

            return dp[idx][start - idxs[idx][0]] = retval;
        }

        solve_line_dfs(0, 0);
        
        for (let i = 0; i < 2; i++)
            for (let j = 1; j < N; j++)
                result[i][j] += result[i][j - 1];
        
        const mapping = [-1, 1, 2, 0];
        const retval = new Array(N).fill(0);

        for (let i = 0; i < N; i++) {
            if (result[0][i])
                retval[i] += 2;
            if (result[1][i])
                retval[i] += 1;

            retval[i] = mapping[retval[i]];
        }

        return retval;
    }

    async solve() {
        const { width: M, height: N, board, hint, change_listener: change } = this;

        this.clear_board();

        const queue = Array.from({ length: N + M }, (_, i) => i);
        const in_queue = new Array(N + M).fill(true);
        while (queue.length) {
            const idx = queue.shift()
            in_queue[idx] = false;

            if (idx < N) {
                const i = idx;
                const arr = Array.from({ length: M }, (_, j) => board[i][j]);
                const result = this.solve_line(hint[0][i], arr);

                await change([idx, queue]);

                for (let j = 0; j < M; j++) {
                    if (result[j] == -1) {
                        board[i][j] = -1;
                        throw Error('해결 불가능한 노노그램 퍼즐입니다.');
                    }
                    if (board[i][j] == result[j])
                        continue;

                    board[i][j] = result[j];
                    await change([idx, queue]);

                    if (!in_queue[N + j]) {
                        queue.push(N + j);
                        in_queue[N + j] = true;
                    }
                }
            }

            else {
                const j = idx - N;
                const arr = Array.from({ length: N }, (_, i) => board[i][j]);
                const result = this.solve_line(hint[1][j], arr);

                for (let i = 0; i < N; i++) {
                    if (result[i] == -1) {
                        board[i][j] = -1;
                        throw Error('해결 불가능한 노노그램 퍼즐입니다.');
                    }
                    if (board[i][j] == result[i])
                        continue;

                    board[i][j] = result[i];
                    await change([idx, queue]);

                    if (!in_queue[i]) {
                        queue.push(i);
                        in_queue[i] = true;
                    }
                }
            }
        }
    }

    clear_board() {
        const { board, width, height } = this

        for (let i = 0; i < height; i++)
            for (let j = 0; j < width; j++)
                board[i][j] = 0
    }
}

class CanvasManager {
    solver
    ctx
    button
    delay

    constructor(solver, canvas, button) {
        this.solver = solver;
        this.ctx = canvas.getContext('2d');
        this.button = button;
        this.delay = 0;

        this.init();
    }

    init() {
        const { solver, button } = this;
        solver.board.change_listener = this.change.bind(this);
        button.onclick = this.run.bind(this);
        this.draw();
    }

    async run() {
        const { solver, delay } = this;

        if (delay < 0) {
            solver.board.board = this.data;
            this.draw();
            return;
        }

        try {
            await solver.solve();
        }
        catch (e) { }

        const { board } = solver;
        const { width, height } = board;

        for (let i = 0; i<height; i++)
            for (let j=0; j<width; j++)
                if (board.board[i][j] == 0)
                    board.board[i][j] = 3;

        this.draw();
    }

    draw(change_data) {
        const ratio = 0.01;

        const { min, max } = Math;

        const { solver, ctx } = this;
        const { board } = solver;
        let { width: canvas_width, height: canvas_height } = ctx.canvas;
        const { width, height, hint, board: arr } = board;
        const [hint_width, hint_height] = Array.from({ length: 2 }, (_, i) => max(this.get_max_length(hint[i]), 1));
        const [real_width, real_height] = [width + hint_width, height + hint_height];

        ctx.save();

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas_width, canvas_height);

        ctx.translate(canvas_width * ratio, canvas_height * ratio);
        canvas_width = canvas_width * (1 - 2 * ratio);
        canvas_height = canvas_height * (1 - 2 * ratio);

        const gap = min(canvas_width / real_width, canvas_height / real_height);
        ctx.translate(
            (canvas_width - gap * real_width) / 2,
            (canvas_height - gap * real_height) / 2,
        );
        canvas_width = gap * real_width;
        canvas_height = gap * real_height;

        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${0 | gap * 0.6}px consolas`;

        for (let i = 0; i < height; i++) {
            let h = hint[0][i];
            if (h.length == 0)
                h = [0];

            for (let j = 0; j < h.length; j++) {
                ctx.fillText(
                    h[j],
                    (hint_width - h.length + j + 0.5) * gap,
                    (hint_height + i + 0.5) * gap
                );
            }
        }

        for (let i = 0; i < width; i++) {
            let h = hint[1][i];
            if (h.length == 0)
                h = [0];

            for (let j = 0; j < h.length;j++) {
                ctx.fillText(
                    h[j],
                    (hint_width + i + 0.5) * gap,
                    (hint_height - h.length + j + 0.5) * gap
                );
            }
        }

        for (let i = 0 ;i < height; i++) {
            for (let j = 0; j < width; j++) {
                ctx.save();
                ctx.translate((hint_width + j)*gap, (hint_height + i)*gap);
                this.draw_tile(arr[i][j], gap);
                ctx.restore();
            }
        }

        ctx.strokeStyle = "#000000";
        for (let i = hint_height; i <= real_height; i++) {
            ctx.beginPath();
            ctx.moveTo((0) * real_width * gap, (i) * gap);
            ctx.lineTo((1) * real_width * gap, (i) * gap);
            ctx.stroke();
        }

        for (let j = hint_width; j <= real_width; j++) {
            ctx.beginPath();
            ctx.moveTo((j) * gap, (0) * real_height * gap);
            ctx.lineTo((j) * gap, (1) * real_height * gap);
            ctx.stroke();
        }

        if (!change_data) {
            ctx.restore();
            return;
        }

        const [now, data] = change_data;
        const queue = [now, ...data];

        for (let i = queue.length - 1; i >= 0; i--) {
            const line = queue[i];
            if (i)
                ctx.fillStyle = "#ffff0044";
            else
                ctx.fillStyle = "#00ff0044";

            if (line < height) {
                ctx.fillRect(
                    (0)*gap,
                    (hint_height + line)*gap,
                    (real_width)*gap,
                    (1)*gap
                );
            }
            else {
                ctx.fillRect(
                    (hint_width + line - height)*gap,
                    (0)*gap,
                    (1)*gap,
                    (real_height)*gap
                );
            }
        }

        ctx.restore();
    }

    draw_tile(tile, size) {
        const { ctx } = this;

        ctx.save();

        switch(tile) {
            case 0:
                break;

            case 1:
                ctx.fillStyle = `#444444`;
                ctx.fillRect(0, 0, size, size);
                break;

            case 2:
                ctx.strokeStyle = `#aaaaaa`;
                ctx.beginPath();
                ctx.moveTo(0 * size, 0 * size);
                ctx.lineTo(1 * size, 1 * size);
                ctx.moveTo(1 * size, 0 * size);
                ctx.lineTo(0 * size, 1 * size);
                ctx.stroke();
                break;

            case 3:
                ctx.fillStyle = `#abcdef`;
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = `#000000`;
                ctx.fillText("?", size / 2, size / 2);
                break;

            case -1:
                ctx.fillStyle = `#ff0000`;
                ctx.fillRect(0, 0, size, size);
                break;
        }

        ctx.restore();
    }

    get_max_length(line_hint) {
        const { max } = Math;
        let retval = 0;
        for (const hint of line_hint)
            retval = max(retval, hint.length);
        return retval;
    }

    async change(change_data) {
        await Utility.delay(this.delay);
        this.draw(change_data);
    }
}

var pre_manager;

function init() {
    const random_image = Array.from({ length: 30 }, () =>
        Array.from({ length: 30 }, () => 
            (Math.random() < 0.6 ? 1 : 2)
        )
    );

    const test_cases = [
        [image_data[0], 70, 'canvas-demonstration-1', 'button-demonstration-1'],
        [image_data[1], 70, 'canvas-demonstration-2', 'button-demonstration-2'],
        [image_data[2], 1, 'canvas-demonstration-4', 'button-demonstration-4'],
        [random_image, 1, 'canvas-demonstration-5', 'button-demonstration-5'],
        [[[2]], 10, 'canvas-demonstration-6', 'button-demonstration-6'],
        [image_data[3], -1, 'canvas-demonstration-7', 'button-demonstration-7'],
    ];

    for (const [data, delay, canvas_id, button_id] of test_cases) {
        const canvas = document.getElementById(canvas_id);
        const button = document.getElementById(button_id);

        const solver = new Solver(data[0].length, data.length);
        solver.attach_hint(Solver.make_hint_from_array(data));
        
        const manager = new CanvasManager(solver, canvas, button);
        manager.data = data;
        manager.delay = delay;
        if (canvas_id == 'canvas-demonstration-6')
            pre_manager = manager;
    }

    {
        const hint = [[[2], [1]], [[2], [2]]];
        const delay = 70;
        const canvas_id = 'canvas-demonstration-3';
        const button_id = 'button-demonstration-3';
        const canvas = document.getElementById(canvas_id);
        const button = document.getElementById(button_id);

        const solver = new Solver(2, 2);
        solver.attach_hint(hint);
        
        const manager = new CanvasManager(solver, canvas, button);
        manager.delay = delay;
    }

    document.getElementById('button-import').addEventListener('click', ()=>{
        try {
            const value = document.getElementById('input-text').value;
            const data = JSON.parse(value);
            const canvas_id = 'canvas-demonstration-6';
            const button_id = 'button-demonstration-6';

            const canvas = document.getElementById(canvas_id);
            const button = document.getElementById(button_id);

            const solver = new Solver(data[0].length, data.length);
            solver.attach_hint(Solver.make_hint_from_array(data));

            const manager = new CanvasManager(solver, canvas, button);
            manager.delay = 10;

            manager.draw();
            delete pre_manager;
            pre_manager = manager;
        } catch (e) {
            alert("잘못된 입력 데이터가 존재합니다.");
        }
    });
}

window.addEventListener('load', init);