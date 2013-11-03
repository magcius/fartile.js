(function(exports) {
    "use strict";

    function compileShader(gl, str, type) {
        var shader = gl.createShader(type);

        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }

    function M(X) {
        return X.join('\n');
    }

    var VERT_SHADER_SOURCE = M([
        'uniform mat4 u_modelView;',
        'uniform mat4 u_projection;',
        'attribute vec3 a_position;',
        'varying vec3 v_position;',
        '',
        'void main() {',
        '    v_position = a_position;',
        '',
        '    gl_Position = u_projection * u_modelView * vec4(a_position, 1.0);',
        '}',
    ]);

    var FRAG_SHADER_SOURCE = M([
        'precision mediump float;',
        '',
        'uniform vec3 u_modelColor;',
        'varying vec3 v_position;',
        '',
        'void main() {',
        '    vec3 color = u_modelColor;',
        '    gl_FragColor = vec4(color, 1.0) + (v_position.z / 1.5);',
        '}',
    ]);

    function createProgram(gl) {
        var vertShader = compileShader(gl, VERT_SHADER_SOURCE, gl.VERTEX_SHADER);
        var fragShader = compileShader(gl, FRAG_SHADER_SOURCE, gl.FRAGMENT_SHADER);

        var prog = gl.createProgram();
        gl.attachShader(prog, vertShader);
        gl.attachShader(prog, fragShader);
        gl.linkProgram(prog);

        prog.modelViewLocation = gl.getUniformLocation(prog, "u_modelView");
        prog.projectionLocation = gl.getUniformLocation(prog, "u_projection");
        prog.positionLocation = gl.getAttribLocation(prog, "a_position");
        prog.modelColorLocation = gl.getUniformLocation(prog, "u_modelColor");

        return prog;
    }

    var TileType = {
        FLAT: 0,
        SLOPE_N: 1,
        SLOPE_E: 2,
        SLOPE_S: 3,
        SLOPE_W: 4,
        SLOPE_NW: 5,
        SLOPE_NE: 6,
        SLOPE_SE: 7,
        SLOPE_SW: 8,
        CORNER_N: 9,
        CORNER_E: 10,
        CORNER_S: 11,
        CORNER_W: 12,
    };

    var TILE_VERT_HEIGHTS = [
        [0, 0, 0, 0], // FLAT
        [1, 1, 0, 0], // SLOPE_N
        [0, 1, 1, 0], // SLOPE_E
        [0, 0, 1, 1], // SLOPE_S
        [1, 0, 0, 1], // SLOPE_W
        [1, 0, 0, 0], // SLOPE_NW
        [0, 1, 0, 0], // SLOPE_NE
        [0, 0, 1, 0], // SLOPE_SE
        [0, 0, 0, 1], // SLOPE_SW
        [0, 1, 1, 1], // CORNER_N
        [1, 0, 1, 1], // CORNER_E
        [1, 1, 0, 1], // CORNER_S
        [1, 1, 1, 0], // CORNER_W
    ];
    var N_TILES = TILE_VERT_HEIGHTS.length;

    var PLANE_INDEXES = [0, 1, 3, 2];

    var GRID_SIZE = 1;
    var GRID_HEIGHT = 0.5;

    var TILE_N_VERTS = 4;
    var TILE_N_VERT_ITEMS = TILE_N_VERTS * 3;
    var TILE_N_VERT_BYTES = TILE_N_VERT_ITEMS * Float32Array.BYTES_PER_ELEMENT;

    var TILE_N_INDXS = 4;
    var TILE_N_INDX_BYTES = TILE_N_INDXS * Uint16Array.BYTES_PER_ELEMENT;

    function createTile(verts, tile, x, y) {
        var z = Math.floor(tile / N_TILES) * GRID_HEIGHT;
        var tileType;
        if (tile < 0)
            tileType = -(tile+1) % N_TILES;
        else
            tileType = tile % N_TILES;
        var heights = TILE_VERT_HEIGHTS[tileType];

        verts[0]  = x;
        verts[1]  = y;
        verts[2]  = z + (heights[0] * GRID_HEIGHT);

        verts[3]  = x;
        verts[4]  = y + GRID_SIZE;
        verts[5]  = z + (heights[1] * GRID_HEIGHT);

        verts[6]  = x + GRID_SIZE;
        verts[7]  = y + GRID_SIZE;
        verts[8]  = z + (heights[2] * GRID_HEIGHT);

        verts[9]  = x + GRID_SIZE;
        verts[10] = y;
        verts[11] = z + (heights[3] * GRID_HEIGHT);
    }

    var RED   = [0.6, 0.8, 0.2];
    var GREEN = [0.4, 0.2, 0.8];

    function createTiles(gl, map) {
        var mapSize = map[0].length * map.length;
        var verts = new Float32Array(mapSize * TILE_N_VERT_ITEMS);
        var indxs = new Uint16Array(mapSize * TILE_N_INDXS);
        console.log(mapSize);

        var model = {};
        model.primitives = [];

        map.forEach(function(row, y) {
            row.forEach(function(tile, x) {
                var N = row.length;
                var i = y * N + x;
                var tileVerts = new Float32Array(verts.buffer, TILE_N_VERT_BYTES * i, TILE_N_VERT_ITEMS);
                createTile(tileVerts, tile, x * GRID_SIZE, y * GRID_SIZE);

                var prim = {};

                var vertIndexes = PLANE_INDEXES.map(function(n) {
                    return TILE_N_VERTS * i + n;
                });
                indxs.set(vertIndexes, TILE_N_INDXS * i);

                prim.start = TILE_N_INDX_BYTES * i;
                prim.count = TILE_N_INDXS;

                var color;
                if (x % 2 == y % 2)
                    color = RED;
                else
                    color = GREEN;
                prim.color = color;

                model.primitives.push(prim);
            });
        });

        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

        var elementBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indxs, gl.STATIC_DRAW);

        model.buffer = buffer;
        model.elementBuffer = elementBuffer;

        var prog = createProgram(gl);
        model.program = prog;

        return model;
    }

    var TEST_MAP = [
        [0,   0,  0,  0,  0,  0,   0, 0],
        [0,   7,  2,  2,  2,  2,   6, 0],
        [0,   3, 13, 13, 13, 13,   1, 0],
        [0,   3, 13, 13, 13, 13,   1, 0],
        [0,   8,  4,  4,  4,  4,   5, 0],
        [0, -12, -5, -5, -5, -5, -11, 0],
        [0,  -2, -1, -1, -1, -1,  -4, 0],
        [0, -13, -3, -3, -3, -3, -10, 0],
        [0,   0,  0,  0,  0,  0,   0, 0],
    ];

    function createScene(gl) {
        var modelView = mat4.create();

        var projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, gl.viewportWidth / gl.viewportHeight, 0.2, 256);

        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clearColor(0.2, 0.2, 0.4, 1);

        gl.enable(gl.DEPTH_TEST);

        function renderModel(model) {
            var prog = null;
            function setProgram(program) {
                prog = program;
                gl.useProgram(prog);
            }

            function setColor(color) {
                gl.uniform3fv(prog.modelColorLocation, color);
            }

            function renderPrimitive(prim, i) {
                setColor(prim.color);
                gl.drawElements(gl.TRIANGLE_STRIP, prim.count, gl.UNSIGNED_SHORT, prim.start);
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, model.buffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.elementBuffer);

            setProgram(model.program);

            gl.uniformMatrix4fv(prog.projectionLocation, false, projection);
            gl.uniformMatrix4fv(prog.modelViewLocation, false, modelView);
            gl.vertexAttribPointer(prog.positionLocation, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(prog.positionLocation);
            model.primitives.forEach(renderPrimitive);
            gl.disableVertexAttribArray(prog.positionLocation);
        }

        var models = [];
        function attachModel(model) {
            models.push(model);
        }
        function setCamera(matrix) {
            mat4.copy(modelView, matrix);
        }
        function render() {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            models.forEach(renderModel);
        }

        var scene = {};
        scene.attachModel = attachModel;
        scene.setCamera = setCamera;
        scene.render = render;
        return scene;
    }

    window.addEventListener('load', function() {
        var canvas = document.querySelector("canvas");
        var gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;

        var scene = createScene(gl);

        var tiles = createTiles(gl, TEST_MAP);
        scene.attachModel(tiles);

        var mouseX = 0, mouseY = 0;
        function update() {
            var camera = mat4.create();
            var mx = ((mouseX / window.innerWidth) - 0.5) * 30 + 4;
            var my = ((mouseY / window.innerHeight) - 0.5) * 30 + 4;
            mat4.lookAt(camera, [mx, my, 4], [4, 4, 0], [0, 0, 1]);
            scene.setCamera(camera);
            scene.render();
        }

        window.addEventListener('mousemove', function(event) {
            mouseX = event.clientX;
            mouseY = event.clientY;
            update();
        });

        update();
    });

})(window);
