// Author: Juuso Kuokkanen
// this will be the main file of the library (Will most probably contain all the code)

var WEBGL_LIB = WEBGL_LIB || {};

WEBGL_LIB.Renderer = function(width, height){
    /*
     * Renderer
     * 
     * Renderer is a main object of whole library, that takes care of rendering the active world with it's objects and settings.
     * 
     * @param {type} parameters
     * @returns {undefined}
     */
    
    /*Initialization methods
    */
   
   this.createGLContext = function(){
        /*
         * Receives the webgl accessing contexts from the canvas generated.
         * Checks in simple way if the user setup supports WebGL, and if not,
         * alerts user about that.
         */
        try{
            gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
	}catch(e){
            alert("webgl_lib: Error received while creating webgl context: " + e.message);
	}	
	//check that webgl context gotten
	if(!gl){
            alert("webgl_lib: Unable to initialize webgl. Browser used may not support it.")
            gl = null;
	}
        this.gl = gl;
    };
    
    this.setupRenderer = function(){
       // Sets general render settings used normally.
       // TODO : There should be a way to change some settings depending on desired outcome with sertain meshes.
        var gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
	gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    };
    
    this.createShaders = function(){
        /*
         * Creates the default vertex and fragment shader programs, compiles them and ads them to be used with
         * program.
         */
        //TODO: Add possible way to rewrite the shader sources
        var gl = this.gl;
        
        if(!this.shaders["vertex"]){
            this.shaders["vertex"] = {
            type : gl.VERTEX_SHADER,
            compiled : null,
            source : [
                //attributes
                "attribute vec3 aPosition;",
                "attribute vec2 aTextureCoord;",
                "attribute vec3 aNormalVector;",
                
                //mesh and camera transformations properties
                "uniform mat4 uModelMatrix;",
                "uniform mat4 uCameraMatrix;",
                "uniform mat4 uProjectionMatrix;",
                "uniform mat3 uNormalTransMatrix;",
                
                "varying vec2 vTextureCoord;",
                "varying vec3 vNormalVector;",
                "varying vec3 vFragPosition;",
                "void main(void){",
                    "gl_Position = uProjectionMatrix * uCameraMatrix * uModelMatrix * vec4(aPosition, 1.0);",
                    "gl_PointSize = 2.0;",
                    "vec4 fragPos = uModelMatrix * vec4(aPosition, 1.0);",
                    "vFragPosition = vec3(fragPos) / fragPos.w;",
                    "vTextureCoord = aTextureCoord;",
                    "vec3 normalVector = normalize(uNormalTransMatrix * aNormalVector);",
                    "vNormalVector = normalVector;",
                "}"
            ].join("\n")
            }
        };
        
        if(!this.shaders["fragment"]){
            this.shaders["fragment"] = {
            type : gl.FRAGMENT_SHADER,
            compliled : null,
            source : [
                "precision highp float;",
                // CONSTANTS
                "#define MAX_POINT_LIGHTS " + this.shaderConfs.maxPointLights ,
                "#define MAX_SPOTLIGHTS " + this.shaderConfs.maxPointLights ,
                
                // UNIFORMS
                "uniform mat4 uModelMatrix;",
                "uniform mat4 uCameraMatrix;",
                "uniform vec3 uCameraPosition;",
                //Textures and mesh properties
                "uniform sampler2D uTextureSampler0;",
                "uniform float uSpecular;",
                "uniform vec3 uSpecularColor;",
                "uniform bool uUseLigthing;",
                "uniform vec3 uSurfaceColor;",
                "uniform bool uUseTexturing;",
                
                // Global lighting uniforms
                "uniform vec3 uDirLightColor;",
                "uniform vec3 uDirLightDirection;",
                "uniform vec3 uAmbientLight;",
                
                // Point lights struct/uniforms
                "uniform int uPointLightCount;",
                "uniform struct PointLight {",
                    "vec3 position;",
                    "vec3 color;",
                    "float length;",
                "} uPointLights[MAX_POINT_LIGHTS];",
                
                // Spotlight struct/uniforms
                "uniform int uSpotlightCount;",
                "uniform struct Spotlight {",
                    "vec3 position;",
                    "vec3 target;",
                    "vec3 color;",
                    "float angle;",
                    "float length;",
                    "float hardness;",
                "} uSpotlights[MAX_SPOTLIGHTS];",
                
                // INCOMING VARYING VARIABLES
                "varying vec2 vTextureCoord;",
                "varying vec3 vNormalVector;",
                "varying vec3 vFragPosition;",
                // FUNCTIONS
                // Calculate diffuse component
                "vec3 calculateDiffuse(vec3 lightColor, vec3 lightDirection, float attenuation){",
                    "vec3 normal = normalize(vNormalVector);",
                    "vec3 normLDir = normalize(lightDirection);",
                    "float angle = max(dot(normLDir, normal), 0.0);",
                    "return lightColor * angle * attenuation;",
                "}",
                
                // Calculate specular component
                "vec3 calculateSpecular(vec3 lightColor, vec3 lightDirection, float attenuation){",
                    "float specularEffect = 0.0;",
                    "vec3 normLDir = normalize(lightDirection);",
                    "vec3 normal = normalize(vNormalVector);",
                    "float diffuse = max(dot(normLDir, normal), 0.0);",
                    "if(diffuse > 0.0){",
                        "vec3 viewVector = normalize(uCameraPosition - vFragPosition);",
                        "vec3 halfAngle = normalize(normLDir + viewVector);",
                        "float specAngle = max(dot(normal, halfAngle), 0.0);",
                        "specularEffect = pow(specAngle, uSpecular);",
                    "}",
                    "return uSpecularColor * lightColor * specularEffect * attenuation;",
                "}",
                
                // function used to apply lighting caused by single point lightlight to fragment
                "vec3 applyPointLight(PointLight pLight){",
                    "vec3 lightingValue = vec3(0.0, 0.0, 0.0);",
                    "vec3 lightRay = pLight.position - vFragPosition;",
                    "float distance = length(lightRay);",
                    "lightRay = normalize(lightRay);",
                    "if(distance < pLight.length){",
                        //Calculate diffuse ligting
                        // light attenuation (Beginning WebGL for HTML5 s.103)
                        // http://gamedev.stackexchange.com/questions/56897/glsl-light-attenuation-color-and-intensity-formula
                        "float attenuation = clamp(1.0 - distance / pLight.length, 0.0, 1.0);",
                        "attenuation *= attenuation;",
                        "vec3 diffuse = calculateDiffuse(pLight.color, lightRay, attenuation);",
                        //calculate Blinn-Phong specular ligting
                        "vec3 specular = calculateSpecular(pLight.color, lightRay, attenuation);",
                        "lightingValue = diffuse + specular;",
                    "}",
                   "return lightingValue;",
                "}",
                
                // function used to apply lighting caused by single spotlightlight to fragment
                "vec3 applySpotlight(Spotlight sLight){",
                    "vec3 lightingValue = vec3(0.0, 0.0, 0.0);",
                    "vec3 lDirection = normalize(sLight.target - sLight.position);",
                    "vec3 lightRay = sLight.position - vFragPosition;",
                    "float distance = length(lightRay);",
                    //check if the light ray is in the spotlight cones area
                    "float lightValue = max(dot(normalize(vNormalVector), normalize(lightRay)), 0.0);",
                    "if(lightValue > 0.0){",
                        "float spotEffect = dot(lDirection, normalize(-lightRay));",
                        "if(spotEffect > cos(sLight.angle)){",
                            "if(distance < sLight.length){",
                                // calculate spotlight diffuse
                                // hardness sets the hardness of spotlights edge
                                "spotEffect = max(pow(spotEffect, sLight.hardness), 0.0);",
                                "float attenuation = clamp(1.0 - distance / sLight.length, 0.0, 1.0);",
                                //"attenuation *= attenuation;",
                                "vec3 diffuseLight = (sLight.color * lightValue* spotEffect * attenuation);",
                                // calculate spotlight specular
                                "vec3 specularLight = calculateSpecular(sLight.color, lightRay, spotEffect * attenuation);",
                                "lightingValue = diffuseLight + specularLight;",
                            "}",
                        "}",
                    "}",
                    "return lightingValue;",
                "}",
               
                // MAIN FUNCTION
                "void main(void){",
                    // surface color will hold either the surface color by default, or the texels color, if textures are being used
                    "vec4 surfaceColor = vec4(uSurfaceColor, 1.0);",
                    "if(uUseTexturing == true){",
                        // get texture color value
                        "surfaceColor = texture2D(uTextureSampler0, vec2(vTextureCoord.s, vTextureCoord.t));",
                    "}",
                    
                    "if(uUseLigthing==true){",
                        //calculate worlds directional lighting with specular
                        "vec3 dirDiffuse = calculateDiffuse(uDirLightColor, -uDirLightDirection, 1.0);",
                        "vec3 dirSpecular = calculateSpecular(uDirLightColor, -uDirLightDirection, 1.0);",
                        "vec3 dirLighting = dirDiffuse + dirSpecular;",
                        "vec3 globalLighting = uAmbientLight + dirLighting;",
                        "vec3 localLighting = vec3(0.0, 0.0, 0.0);",
                        // calculate point lights effect
                        "for(int i = 0; i < MAX_POINT_LIGHTS; i++){",
                            "if(i < uPointLightCount){",
                                "localLighting += applyPointLight(uPointLights[i]);",
                            "} else {",
                                "break;",
                            "}",
                        "}",
                        // calculate spotlights effect
                        "for(int i = 0; i < MAX_SPOTLIGHTS; i++){",
                            "if(i < uSpotlightCount){",
                                "localLighting += applySpotlight(uSpotlights[i]);",
                            "} else {",
                                "break;",
                            "}",
                        "}",
                        "gl_FragColor = vec4((surfaceColor.rgb * (globalLighting + localLighting)), surfaceColor.a);",
                    "} else {",
                            "gl_FragColor = surfaceColor;",
                    "}",
                "}"
            ].join("\n")
            };
        }
        
        for(var key in this.shaders){
            var shader = this.shaders[key];
            shader.compiled = gl.createShader(shader.type);
            gl.shaderSource(shader.compiled, shader.source);
            gl.compileShader(shader.compiled);
            if(!gl.getShaderParameter(shader.compiled, gl.COMPILE_STATUS)){
                console.error("Error on compiling " + key + " shader: " + gl.getShaderInfoLog(shader.compiled));
                shader.compiled = null;
            } 
        }
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, this.shaders.vertex.compiled);
        gl.attachShader(this.program, this.shaders.fragment.compiled);
        gl.linkProgram(this.program);
        if(gl.getProgramParameter(this.program, gl.LINK_STATUS)){
            gl.useProgram(this.program);
        }else{
            //TODO: More info?
            console.error("Error on linking the program: " + gl.getProgramInfoLog(this.program));
            this.program = null;
        }
    };
    
    this.setupDefaultTexture = function(){
        /*
         * Creates default texture object, that uses defaultImage (gray 1x1 png) as texture data.
         * Called during first render call.
         */
        var gl = this.gl;
        
        this.defaultTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        //bind texture to active texture unit
        gl.bindTexture(gl.TEXTURE_2D, this.defaultTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.loadedTextures.defaultImage.image);
        gl.bindTexture(gl.TEXTURE_2D, null);
        
    };
    
    this.loadDefaultImage = function(){
        var image = new Image();
        image.onload = function(renderer){
            renderer.loadedTextures["defaultImage"] = {
                image : image,
                name : "defaultImage",
                texture : null
            }
            renderer.defaultImageLoaded = true;
        }(this);
        image.src="data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";
    };
    
    /*Object members
     * gl - WebGL context received from canvas
     * canvas - Canvas-element to which we render to
     * worlds - array of worlds created to renderer
     * loadedModels - object of loaded models, so that they can be reused after loaded once
     * loadedTextures - object containing all of loaded images, setup textures so that they can be reused afrer loaded once
     */
    
    //create canvas element and set size
    this.canvas = document.createElement("canvas");
    this.canvas.width = width ? width : 600;
    this.canvas.height = height ? height : 500;
    
    //Setup rendering context and rendereing depth, clear params etc.
    this.createGLContext();
    this.setupRenderer();
    this.shaderConfs = {
        maxPointLights : 10,
        maxSpotlights : 10
    };
    this.shaders = {};
    this.program = null;
    //create initial shaders
    this.createShaders();
    this.worlds = {};
    this.activeWorld = null;
    //TODO: Rename models to mesh? Model seems kind of like textured model (aka. complete) while these are just the position,normal data
    this.loadedModels = {};
    this.defaultImageLoaded = false;
    this.loadedTextures = {};
    this.defaultTexture = null;
    this.loadDefaultImage();
    this.primitiveModes = {
        TRIANGLES : this.gl.TRIANGLES,
        LINES : this.gl.LINES,
        POINTS : this.gl.POINTS
    };
    
    /*
     * Renderer methods
     */
    
    this.createWorld = function(name){
        /*
         * Creates a new world to renderer, and stores it into world obejct with the name provieded as parameter,
         * or that is generated automatically based on number of worlds in the renderer.
         */
        var setActive = false;

        if(Object.keys(this.worlds).length === 0){
            setActive = true;
        };
        
        if(typeof(name) !== typeof("string")){
            name = "world" + Object.keys(this.worlds).length;
        }
        this.worlds[name] = {
            //World object
            /*
             * World objects are used to store meshes, lights and global lighting settings, cameras into one place,
             * where they are accesed in the rendering sequence to produce desired image with resources that were added.
             */
            //Object variables
            renderer : this,
            meshes : [],
            cameras : [],
            pointLights : [],
            spotlights : [],
            ambientLight : new WEBGL_LIB.Math.Entities.Vector3f(1.0, 1.0, 1.0),
            directionalLightColor : new WEBGL_LIB.Math.Entities.Vector3f(0.0, 0.0, 0.0),
            directionalLightDir : new WEBGL_LIB.Math.Entities.Vector3f(0.0, 0.0, 0.0),
            activeCamera : null,
            
            //Object functions
            setActiveCamera : function(camera){
                /*
                * Set worlds active active camera. 
                * Active camera are used to provide desired view and  projection transformations on rendering.
                */
                this.activeCamera = camera;
            },
            
            addCamera : function(camera){
                /*
                 * Function to add camera to world, and if first camera added, it will be set as active camera. 
                 * Active camera are used to provide desired view and  projection transformations on rendering.
                 */
                // TODO: Is there any meaning/reason to store the cameras into array?
                this.cameras.push(camera);
                if(this.cameras.length === 1){
                    this.activeCamera = camera;
                }
            },
            
            addMesh : function(mesh){
                /*
                 * Function to add mesh objects to world. Each object added will be used in rendering.
                 */
                mesh.world = this;
                this.meshes.push(mesh);
            },
            
            addSpotlight : function(light){
                /*
                 * Function to add mesh objects to world. Each object added will be used in rendering.
                 */
                light.world = this;
                this.spotlights.push(light);
            },
            
            addPointLight : function(light){
                /*
                 * Function to add mesh objects to world. Each object added will be used in rendering.
                 */
                light.world = this;
                this.pointLights.push(light);
            }
        };
        if(setActive){
            this.activeWorld = this.worlds[name];
        };
    };
};

WEBGL_LIB.Renderer.prototype.resizeRenderer = function(width, height){
    this.canvas.width = width;
    this.canvas.height = height;
    if(this.gl !== null){
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    if(this.activeWorld){
        if(this.activeWorld.activeCamera){
            var camera = this.activeWorld.activeCamera;
            camera.properties.width = width;
            camera.properties.height = height;
            camera.resetProjection();
        }
    }
};

WEBGL_LIB.Renderer.prototype.setActiveWorld = function(worldName){
    /*
     * Sets the activeWorld of renderer, which will be used to rendere the next image.
     */
    if(this.worlds[worldName]){
        this.activeWorld = this.worlds[worldName];
    }
};

WEBGL_LIB.Renderer.prototype.loadImage = function(path, name){
    /*
     * Loads the defined texture image from path, and stores it into loadedTextures object of Renderer
     * form where it cane be later assigned to mesh as a texture.
     */
    if(name && typeof(name) === "string"){
        var image = new Image();
        image.onload = (function(renderer, name){
            // store image, WebGLtexture and name of texture into same object
            renderer.loadedTextures[name] = {
                image : image,
                texture : null,
                name : name
            };
        }(this, name));
        image.src = path; 
    }else{
        console.error("renderer.loadImage: name string not provided");
    }
};

//TODO: Or is it better to just bind the texture over and over again, by ung the image, and taking memory with the texture object
WEBGL_LIB.Renderer.prototype.setupTexture = function(textureName){
    /*
     * Used to create new texture-object for this mesh, that will be used in rendering
     * call, if texture image is set for the mesh.
     */
    var textureObj = this.loadedTextures[textureName];
    if(textureObj.image){
       if(textureObj.image.complete){
            var gl = this.gl;
            textureObj.texture = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0);
            //bind texture to active texture unit
            gl.bindTexture(gl.TEXTURE_2D, textureObj.texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); 
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureObj.image);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }
};

WEBGL_LIB.Renderer.prototype.setupBuffers = function(model){
    /*
     * This function is called to create WebGL Buffer Objects for the data of this mesh.
     * Function will be caled once before first rendering of object, but it can be called
     * again if the data of mesh has been alterd.
     */
    var gl = this.gl;
    
    model.buffers = {};
    model.buffers.vertexBufferObject = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, model.buffers.vertexBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.vertices.data), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    model.buffers.normalBufferObject = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, model.buffers.normalBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.normals.data), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    model.buffers.textureCoordBufferObject = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, model.buffers.textureCoordBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.textureCoords.data), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    model.buffers.indexBufferObject = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.buffers.indexBufferObject);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(model.indices.vertexIndices), gl.STATIC_DRAW);
};

WEBGL_LIB.Renderer.prototype.render = function(){
    /*
     * Draws single image to canvas by using active wolrd and its properties (added mehses, cameras, lights etc.)
     * to create the image.
     */
    if(this.defaultImageLoaded){
        var gl = this.gl;
        var world = this.activeWorld;
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        
        // setup camera uniforms like transformation matrix, perspective projection matrix 
        // and camera position in world
        var camera = world.activeCamera;
        var cameraTranslationMat = camera.getCameraTranslationMatrix();
        var cameraMatrixUniform = gl.getUniformLocation(this.program, "uCameraMatrix");
        var cameraMatrix = camera.getCameraRotationMatrix().matrixMult(cameraTranslationMat);
        gl.uniformMatrix4fv(cameraMatrixUniform , false, cameraMatrix.array);
        // Projection matrix is constructed from cameras perspective projection member values,
        // so we can get if from camera.
        var projectionMatrixUniform = gl.getUniformLocation(this.program, "uProjectionMatrix");
        var mat4Proj = camera.projectionMatrix;
        gl.uniformMatrix4fv(projectionMatrixUniform, false, mat4Proj.array);
        
        var cameraPositionUniform = gl.getUniformLocation(this.program, "uCameraPosition");
        gl.uniform3fv(cameraPositionUniform, new Float32Array(camera.transformations.location.getArray()));
        
        // Prepare lights on the scene
        var ambientUniform = gl.getUniformLocation(this.program, "uAmbientLight");
        gl.uniform3fv(ambientUniform, new Float32Array(world.ambientLight.getArray()));
        
        var ambientUniform = gl.getUniformLocation(this.program, "uDirLightColor");
        gl.uniform3fv(ambientUniform, new Float32Array(world.directionalLightColor.getArray()));
        
        var ambientUniform = gl.getUniformLocation(this.program, "uDirLightDirection");
        gl.uniform3fv(ambientUniform, new Float32Array(world.directionalLightDir.getArray()));
        // We will go trough all the meshes added to world one by one, and render them to scene
        
        //setup point ligths
        var numberOfPointLights = gl.getUniformLocation(this.program, "uPointLightCount");
        var maxPointLights = this.shaderConfs.maxPointLights;
        var pointLightCount = world.pointLights.length < maxPointLights ? world.pointLights.length : maxPointLights;
        gl.uniform1i(numberOfPointLights, pointLightCount);
        for(var i = 0; i < pointLightCount; i++){
            var pointLight = world.pointLights[i];
            var pointLightPosition = gl.getUniformLocation(this.program, "uPointLights["+ i +"].position");
            var pointLightIntensity = gl.getUniformLocation(this.program, "uPointLights["+ i +"].color");
            var pointLightLength = gl.getUniformLocation(this.program, "uPointLights["+ i +"].length");

            var plPosition = pointLight.position;
            gl.uniform3fv(pointLightPosition, new Float32Array(plPosition.getArray()));
            var plIntensity = pointLight.lightColor;
            gl.uniform3fv(pointLightIntensity, new Float32Array(plIntensity.getArray()));
            gl.uniform1f(pointLightLength, pointLight.lightLength);
        }

        //setup spotlights
        var numberOfSpotlights = gl.getUniformLocation(this.program, "uSpotlightCount");
        var maxSpotlights = this.shaderConfs.maxSpotlights;
        var spotlightCount = world.spotlights.length < maxSpotlights ? world.spotlights.length : maxSpotlights;
        gl.uniform1i(numberOfSpotlights, spotlightCount);
        for(var i = 0; i < spotlightCount; i++){
            var spotlight = world.spotlights[i];
            var spotlightPosition = gl.getUniformLocation(this.program, "uSpotlights["+ i +"].position");
            var spotlightIntensity = gl.getUniformLocation(this.program, "uSpotlights["+ i +"].color");
            var spotlightLength = gl.getUniformLocation(this.program, "uSpotlights["+ i +"].length");
            var spotlightTarget = gl.getUniformLocation(this.program, "uSpotlights["+ i +"].target");
            var spotlightAngle = gl.getUniformLocation(this.program, "uSpotlights["+ i +"].angle");
            var spotlightHardness = gl.getUniformLocation(this.program, "uSpotlights["+ i +"].hardness");

            var slPosition = spotlight.position;
            gl.uniform3fv(spotlightPosition, new Float32Array(slPosition.getArray()));
            var slIntensity = spotlight.lightColor;
            gl.uniform3fv(spotlightIntensity, new Float32Array(slIntensity.getArray()));
            gl.uniform1f(spotlightLength, spotlight.lightLength);
            var slTarget = spotlight.target;
            gl.uniform3fv(spotlightTarget, new Float32Array(slTarget.getArray()));
            gl.uniform1f(spotlightAngle, spotlight.angle);
            gl.uniform1f(spotlightHardness, spotlight.hardness);
        }
        
        //get locations of attributes and uniforms used by mesh in loop
        //vertex and index buffer attributes
        var vertexAttribPointer = gl.getAttribLocation(this.program, "aPosition");
        var normalAttribPointer = gl.getAttribLocation(this.program, "aNormalVector");
        var textCoordAttribPointer = gl.getAttribLocation(this.program, "aTextureCoord");
        //transformation matrices
        var modelMatrixUniform = gl.getUniformLocation(this.program, "uModelMatrix");
        var normalTransUniform = gl.getUniformLocation(this.program, "uNormalTransMatrix");
        //surface coloring settings
        var surfaceColorUniform = gl.getUniformLocation(this.program, "uSurfaceColor");
        var useTexturingUniform = gl.getUniformLocation(this.program, "uUseTexturing");
        // ligthing settings
        var specularUniform = gl.getUniformLocation(this.program, "uSpecular");
        var specularColorUniform = gl.getUniformLocation(this.program, "uSpecularColor");
        var useLigtingUniform = gl.getUniformLocation(this.program, "uUseLigthing");

        for(var i = 0; i < world.meshes.length; i++){
            var mesh = world.meshes[i];
            if(!mesh.model){
                console.error("renderer.render(): Mesh had no model set.");
                continue;
            }
            var model = mesh.model;
            if(!model.buffers){
                this.setupBuffers(model);
            }
            var buffers = model.buffers;
            //TODO: do we want to store the attrib/uniform pointers?
            //ATTRIBUTES
            
            gl.enableVertexAttribArray(vertexAttribPointer);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBufferObject);
            gl.vertexAttribPointer(vertexAttribPointer, 3, gl.FLOAT, false,  0, 0);
            
            
            gl.enableVertexAttribArray(normalAttribPointer);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normalBufferObject);
            gl.vertexAttribPointer(normalAttribPointer, 3, gl.FLOAT, false, 0, 0);

            
            gl.enableVertexAttribArray(textCoordAttribPointer);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoordBufferObject);
            gl.vertexAttribPointer(textCoordAttribPointer, 2, gl.FLOAT, false, 0, 0);

            //UNIFORMS
            //MATRICES
            //
            // Model to view matrix is constructed from models tranformations
            
            var modelMatrix = mesh.getTransformationMatrix();
            gl.uniformMatrix4fv(modelMatrixUniform , false, modelMatrix.array);
            
            var inverseMat3 = mesh.getTransformationMatrix().get3x3Matrix().inverseMatrix();
            var normalTransMatrix = inverseMat3.transposeMatrix();
            gl.uniformMatrix3fv(normalTransUniform, false, normalTransMatrix.array); 
            
            //Handle mesh surface properties (colors, specular, texture)
            var useTexturesInt = mesh.useTexture ? 1 : 0;
            // these determine if the surface will be drawn with color, or with texture, and with what color
            gl.uniform1i(useTexturingUniform, useTexturesInt);
            gl.uniform3fv(surfaceColorUniform, new Float32Array(mesh.surfaceProperties.surfaceColor.getArray()));
            
            // these determine the surfaces specular reflection proeperties
            gl.uniform1f(specularUniform, mesh.surfaceProperties.specular);
            gl.uniform3fv(specularColorUniform, new Float32Array(mesh.surfaceProperties.specularColor.getArray()));
            var useLightsInt = mesh.surfaceProperties.useLighting ? 1 : 0;
            gl.uniform1i(useLigtingUniform, useLightsInt);
            
            //if the texture will be used, setup texture to texture unit 0
            if(mesh.useTexture){
                //TODO: Handle multiple textures for single mesh?
                //TEXTURES
                if(!this.defaultTexture){
                    // setup the default texture (from gray 1x1 png image) on first render
                    this.setupDefaultTexture();
                }
                // We will always use the gray default texture, but if mesh has custom texture set, we will us it.
                // If the meshes texture-object is not set up, we will set it before rendering
                var texture = this.defaultTexture;
                if(mesh.textureObject){
                    if(mesh.textureObject.image.complete){
                        if(mesh.textureObject.texture){
                            texture = mesh.textureObject.texture;
                        }else{
                            this.setupTexture(mesh.textureObject.name);
                            texture = mesh.textureObject.texture;
                        }
                    }
                }
                // We bind the texture-object that is resolved earlier to texture unit 0.
                if(texture){
                    gl.activeTexture(gl.TEXTURE0);
                    //bind texture to active texture unit
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    var textureSamplerUniform = gl.getUniformLocation(this.program, "uTextureSampler0");
                    gl.uniform1i(textureSamplerUniform, 0);
                };
            }
            // We bind the index buffer, and then add draw the mesh.
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indexBufferObject);
            gl.drawElements(this.primitiveModes[mesh.primitiveMode], mesh.model.indices.vertexIndices.length, gl.UNSIGNED_SHORT, 0);  
        } 
    } 
};

WEBGL_LIB.Renderer.prototype.loadModelFromCollada = function(colladaDoc, modelName){
    /*
     * Loads model data from given collada xml-document, and stores it into
     * Renderer.loadedModels with id of geometry as key.
     */
    //TODO: Can we use some extension to prevent complex index/vertex/texCoord parsing sequence?
    // Model data we wan to use is located library_geometries, which contains 0 or more geometry-elements, each represeing one model.
    var geometries = colladaDoc.getElementsByTagName("library_geometries")[0].getElementsByTagName("geometry");
    //to ensure that threre is atleast some name.
    modelName = modelName ? modelName : "model";
    for(var i  = 0; i < geometries.length; i++){
        //resolve model naming
        //if there is only one model in file, use modelName as is
        var name = modelName;
        if(geometries.length > 1){
            // if there are multiple models in file, use additional numbering
            name = modelName + (i+1);
        }
        
        
        var geometry = geometries[i];
        //TODO: Currently loaded mesh keys have also word mesh in end. Perhaps we should remove this for simplyfy the naming.
        this.loadedModels[name] = {
            /*
             * Loaded model contains:
             *  vertices
             *      Position data of the model
             *  normals
             *      Normal data of the model
             *  texture coords
             *      Texture coordinates / UVs of the model
             *  indices
             *      Indices of the module that define the rendering order of vertices
             */
            vertices : {
                count : 0,
                data : [],
                stride : 0
            },
            normals : {
                count : 0,
                data : [],
                stride : 0
            },
            textureCoords : {
                count : 0,
                data : [],
                stride : 0
            },
            indices : {
                vertexIndices : [],
                normalIndices : [],
                texCoordIndices : [],
            }
        };
        
        //mesh-element contains single models position, normal and texture data (and more depending on complexity of model).
        var mesh = geometry.getElementsByTagName("mesh")[0];
        
        //There is 1 -> * sources
        var vertexSources = mesh.getElementsByTagName("source");
        
        //This will hold all sources with the data and needed accessor settings
        var sources = {};
        for(var j = 0; j < vertexSources.length; j++){
            var source = vertexSources[j];
            //Parse source into more accesable object
            var sourceAccessor = source.getElementsByTagName("accessor")[0];
            var dataId = sourceAccessor.attributes.source.value;
            dataId = dataId.substring(1);
            var dataArray = colladaDoc.getElementById(dataId);
            var itemCount = parseInt(dataArray.attributes.count.value);
            var vertexCount = parseInt(sourceAccessor.attributes.count.value);
            var stride = parseInt(sourceAccessor.attributes.stride.value);
            //Parse XML the stirng representing the array into JS array
            var data = [];
            var str = dataArray.innerHTML;
            var strArr = str.split(" ");
            for(var k = 0; k < strArr.length; k++){
                data.push(parseFloat(strArr[k]));
            }
            if(data.length !== itemCount){
                console.debug("Source data array received is too short: " + itemCount + " expected, " + data.length + " were received");
            }
            //TODO: Should we also consider adding the additional accessor params for axel values
            sources[source.id] = {
                dataArray : data,
                arrayLength : itemCount,
                vertexCount : vertexCount,
                stride : stride
            };
        }
        //Vertices is diffrent from polylist, because it defines the vertex position attributes
        //and it can have some specific data for these attributes, like selected state.
        var meshVertices = mesh.getElementsByTagName("vertices")[0];
        var meshVerticesInputs = meshVertices.getElementsByTagName("input");
        
        for(var j = 0; j < meshVerticesInputs.length; j++){
            var input = meshVerticesInputs[j];
            switch(input.attributes.semantic.value){
                case "POSITION":
                    var sourceId = input.attributes.source.value;
                    sourceId = sourceId.substring(1);
                    //Source has technique_common with one accessor, that tells where is the data and how it should be interpreted
                    this.loadedModels[name].vertices.data = sources[sourceId].dataArray;
                    this.loadedModels[name].vertices.count = sources[sourceId].vertexCount;
                    this.loadedModels[name].vertices.stride = sources[sourceId].stride;
                    break;
                default:
                    console.debug("Semantic not supported: " + input.attributes.semantic.value);
                    break;
                        
            }
        };
        
        //TODO: File may contain 0 -> * polylists. Support for multiple polylists required at some point
        //One case for multiple polylists is when geometry has separate materials for different faces of same geometry as described here:
        //https://github.com/DavidBrainard/RenderToolbox3/issues/14
        var meshPolylist = mesh.getElementsByTagName("polylist")[0];
        var polylistInputs = meshPolylist.getElementsByTagName("input");
        var sourceTypes = {};
        
        //get polylists inputs to be able to determine source data meaning with source refrences
        for(var j = 0; j < polylistInputs.length; j++){
            var input = polylistInputs[j];
            //TODO: This will work if only one polylist available. Need to reconsiderer this when we need multiple polylists
            var key = polylistInputs[j].attributes.source.value;
            key = key.substring(1);
            sourceTypes[key] = {
                type : polylistInputs[j].attributes.semantic.value,
                offset : parseFloat(polylistInputs[j].attributes.offset.value)
            };
        }
        
        var maxOffset = 0;
        
        for(var key in sourceTypes){
            var offset = sourceTypes[key].offset;
            maxOffset = maxOffset < offset ? offset : maxOffset;
        }
        
        var indexArrayElem = meshPolylist.getElementsByTagName("p")[0];
        var indexArray = indexArrayElem.innerHTML.split(" ");
        
        for(var key in sourceTypes){
            var sourceType = sourceTypes[key];
            //TODO: This will work if only one polylist available. Need to reconsiderer this when we need multiple polylists
            //TODO: because there is offset, we need to check the max offset, and then we can derive the vertex indices
            //and possibly others if they have any real use for us (DONE: maxOffset)
            //Get whole index array. Processed in index and texcoord generating
            
            // TODO: Is it always 0?
            var vertexOffset = 0;
            switch(sourceType.type){
                case "VERTEX":
                    if(key === meshVertices.id){
                        var finalArray = [];
                        for(var j = sourceType.offset; j < indexArray.length; j += (1+maxOffset)){
                            finalArray.push(parseFloat(indexArray[j]));
                        }
                        this.loadedModels[name].indices.vertexIndices = finalArray;
                        vertexOffset = sourceType.offset;
                    }
                    break;
                case "NORMAL":
                    this.loadedModels[name].normals.data = sources[key].dataArray;
                    this.loadedModels[name].normals.count = sources[key].vertexCount;
                    this.loadedModels[name].normals.stride = sources[key].stride;
                    var finalArray = [];
                    for(var j = sourceType.offset; j < indexArray.length; j += (1+maxOffset)){
                            finalArray.push(parseFloat(indexArray[j]));
                    }
                    this.loadedModels[name].indices.normalIndices = finalArray;
                    break;
                    
                case "TEXCOORD":
                    this.loadedModels[name].textureCoords.data = sources[key].dataArray;
                    this.loadedModels[name].textureCoords.stride = sources[key].stride;
                    this.loadedModels[name].textureCoords.count = sources[key].vertexCount;
                    var finalArray = [];
                    for(var j = sourceType.offset; j < indexArray.length; j += (1+maxOffset)){
                            finalArray.push(parseFloat(indexArray[j]));
                    }
                    this.loadedModels[name].indices.texCoordIndices = finalArray;
                    break;
                default:
                    break;
            };
            
        }
        if(this.loadedModels[name].textureCoords.count){
            //TODO : Create systems that modifies the vertex and index data so, that we duplicate the vertex data, when texturing so requires.
            // If same texture coordinate is used, we can assume, that data is ok. But, if same vertex index occurs with different UV data,
            // this may mean an edge/seam in texture mapping, which requires us to add additional vertex and normal data.
            // get copies of index arrays
            var indexArray = this.loadedModels[name].indices.vertexIndices.slice();
            var normalIndexArray = this.loadedModels[name].indices.normalIndices.slice();
            var texCoordIndexArray = this.loadedModels[name].indices.texCoordIndices.slice();
            //get copies of data arrays and their strides
            var vertexArray = this.loadedModels[name].vertices.data.slice();
            var vertexStride = this.loadedModels[name].vertices.stride;
            var normalArray = this.loadedModels[name].normals.data.slice();
            var normalStride = this.loadedModels[name].normals.stride;
            var texCoordArray = this.loadedModels[name].textureCoords.data.slice();
            var newTexCoords = [];
            var texStride = this.loadedModels[name].textureCoords.stride;
            var vertexUVRelation = {};
            // create object that tells what coordinates are used for which indices
            for(var j = 0; j < indexArray.length; j++){
                //create uv/vertex relationship object that is used later
                var texIndex = texCoordIndexArray[j];
                var normalIndex = normalIndexArray[j];
                var texCoords = texCoordArray.slice(texIndex*texStride, texIndex*texStride+texStride);
                //get index as string, use it as key and store uvs that are related to that index/vertex
                var indIndex = indexArray[j];
                var indIndexStr = indIndex.toString();
                if(vertexUVRelation[indIndexStr]){
                    //check that same coords are not already there
                    var isNot = true;
                    for(var k = 0; k < vertexUVRelation[indIndexStr].texCoords.length; k++){
                        var arr = vertexUVRelation[indIndexStr].texCoords[k].array;
                        var checkingStr = "";
                        for(var l = 0; l < arr.length; l++){
                            if(arr[l] === texCoords[l]){
                                checkingStr += 1;
                            }else{
                                checkingStr += 0;
                            }
                        }
                        // 11 or 111 would mean all coordinates were same
                        if(checkingStr === "11" || checkingStr === "111"){
                            // When same coordinates occur, we just mark the index to be the same
                            // that they were set to be with that texture coordinates (original index or new index
                            // pointing to duplicate vertex data created to end of the vertex data.
                            isNot = false;
                            vertexUVRelation[indIndexStr].texCoords[k].occurred++;
                            indexArray[j] = vertexUVRelation[indIndexStr].texCoords[k].index;
                            break;
                        }
                    }
                    if(isNot){
                        var newIndex = vertexArray.length/vertexStride;
                        vertexUVRelation[indIndexStr].texCoords.push({ array : texCoords, index : newIndex, occurred: 1 });
                        vertexArray.push.apply(vertexArray, vertexArray.slice(indIndex*vertexStride, indIndex*vertexStride+vertexStride));
                        vertexArray.push.apply(normalArray, vertexArray.slice(normalIndex*normalStride, normalIndex*normalStride+normalStride));
                        indexArray[j] = newIndex;
                    }

                }else{
                    vertexUVRelation[indIndexStr] = {texCoords : []};
                    vertexUVRelation[indIndexStr].texCoords.push({ array : texCoords, index : indIndex, occurred: 1});
                }
            }
            
            //create new tex coord array based on indices in vertexUVRelation
            var texCoordObjects = [];
            for(key in vertexUVRelation){
                texCoordObjects.push.apply(texCoordObjects, vertexUVRelation[key].texCoords);
            };
            texCoordObjects.sort(function(a, b){
                return a.index - b.index;
            });
            var newTexCoords = [];
            var prev = -1;
            for(var j = 0; j < texCoordObjects.length; j++){
                newTexCoords.push.apply(newTexCoords, texCoordObjects[j].array);
                if(texCoordObjects[j].index-1 !== prev){
                    console.debug(texCoordObjects[j].index);
                }
                prev = texCoordObjects[j].index;
            };
            this.loadedModels[name].indices.vertexIndices = indexArray;
            this.loadedModels[name].vertices.data = vertexArray;
            this.loadedModels[name].vertices.count = vertexArray.length/vertexStride;
            this.loadedModels[name].normals.data = normalArray;
            this.loadedModels[name].normals.count = normalArray.length/normalStride;
            this.loadedModels[name].textureCoords.data = newTexCoords;
            this.loadedModels[name].textureCoords.count = newTexCoords.length/texStride;
        } else {
            // because of the limitations of the library, we have to make some texture coordinates available
            // so we just create texture coordinates from zeroes
            var vertexCount = this.loadedModels[name].vertices.count;
            for(var j = 0; j < vertexCount; j++){
                // push two texcoords per vertex
                this.loadedModels[name].textureCoords.data.push(0.0);
                this.loadedModels[name].textureCoords.data.push(0.0);
            }
            this.loadedModels[name].textureCoords.stride = 2;
            this.loadedModels[name].textureCoords.count = vertexCount;
        }
    }
    
};

WEBGL_LIB.Renderer.prototype.calculateNormals = function(model, inverse){
    // use inverse to flip the normals. If not true or left undefined, inversion will not happen
    var inversion = inverse ? -1 : 1;
    var vectorData = model.vertices.data;
    var indexData = model.indices.vertexIndices;
    var vectors = [];
    var normals = [];
    var result = [];
    //get each vector into array
    for(var i = 0; i < vectorData.length; i = i + 3){
        vectors.push(new WEBGL_LIB.Math.Entities.Vector3f(vectorData[i], vectorData[i+1], vectorData[i+2]));
    }
    //calculate vector normals per face
    // Calculate one surface normal from current face, and add that to all three
    // vertices of the face, using the index locations. If the index location
    // has a normal (normal from other face that the vertex is part of), add
    // normal together and normalize the result, making each face contribute
    // to the avaraged normal value per vertex
    for(var i = 0; i < indexData.length; i = i + 3){
            var vec1 = indexData[i];
            var vec2 = indexData[i+1];
            var vec3 = indexData[i+2];
            //calc first
            var cross1 = vectors[vec2].subVect(vectors[vec1]);
            var cross2 = vectors[vec3].subVect(vectors[vec1]);
            var normal = cross1.crossProduct(cross2);
            //calc first
            if(!normals[vec1]){
                    normal.normalize();
                    normals[vec1] = normal;
            }else{
                    normal.normalize();
                    normals[vec1] = normals[vec1].addVect(normal);
                    normals[vec1].normalize();
            }
            //calc second
            if(!normals[vec2]){
                    normal.normalize();
                    normals[vec2] = normal;
            }else{
                    normal.normalize();
                    normals[vec2] = normals[vec2].addVect(normal);
                    normals[vec2].normalize();
            }
            //calc third
            if(!normals[vec3]){
                    normal.normalize();
                    normals[vec3] = normal;
            }else{
                    normal.normalize();
                    normals[vec3] = normals[vec3].addVect(normal);
                    normals[vec3].normalize();
            }
    }
    //turn into normal numeric array. Normals will be flipped if inversion set true.
    for(var i in normals){
            var normal = normals[i].mulScal(inversion);
            result.push.apply(result, normal.getArray());
    }
    model.normals.data = result;
		
};

WEBGL_LIB.BaseObject = function(){
    /*
     * BaseObject
     * Basic 3D object that is inherited by other classes that need to be placed into world
     */
    
    /*Initialization functions*/
    
    /*
     * Object members
     * location - location of object space in parent space
     * rotation - rotation/orientation of object space in parent space
     * scale - scale of object space axes in parent space
     * childObjects - array of all the child objects of this object. Child objects will receive transformations from
     *                their parent (this), and their space exisit relative to parent space (this). This will define the
     *                object/transformation hierarchy.
     * baseVectors - These represent the axes of the object in world space. Will need to determine if this has any use or is accurate enough.
     * parent - Tells what is parent of the object in hierarchy. Every object can have only one parent object.
     */
    //scrap these ****
    this.location = new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0);
    this.rotation = new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0);
    this.scale = new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0);
    //scrap these ****
    
    this.childObjects = [];
    
    this.baseVectors = {
        //TODO: Should we delete these(?)
        x : new WEBGL_LIB.Math.Entities.Vector3f(1, 0, 0),
        y : new WEBGL_LIB.Math.Entities.Vector3f(0, 1, 0),
        z : new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 1)
    };
    
    //TODO:
    //perhaps we should just have all or atlest scale and location in root
    //and rename the transformations to rotations, because we want to keep 
    //the rotations to be used behind the functions, while translation and
    //scale would be simple to use even without function (though they are good to
    //have for similarity with rotation setting
    this.transformations = {
        //with this, we will always rotate around some world axes
        worldOrientation : new WEBGL_LIB.Math.Entities.Quaternion(1.0, new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0)),
        localOrientation : new WEBGL_LIB.Math.Entities.Quaternion(1.0, new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0)),
        location : new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0),
        scale : new WEBGL_LIB.Math.Entities.Vector3f(1, 1, 1),
    };
    
    this.parent = null;
};

//BaseObject methods

WEBGL_LIB.BaseObject.prototype.rotateLocal = function(angle, direction){
    //Rotate existing orientation by angle around given direction
    //Local rotation mult order: rot * local
    //Params: angle - rotation amount around defined axis in radians. Defaults to 0
    //        direction - direction around which the rotation is performed. Defaults to (0,0,0)
    
    var rotQuat = WEBGL_LIB.Math.getRotationQuat(angle, direction);
    this.transformations.localOrientation = rotQuat.multQuaternion(this.transformations.localOrientation);
};

WEBGL_LIB.BaseObject.prototype.rotateLocalXYZ = function(angX, angY, angZ){
    //Perform rotation on current orientation along base axes of local space
    //Params: angX - rotation around local X-axis
    //        angY - rotation around local Y-axis
    //        angZ - rotation around local Z-axis
    var rotQuatX = WEBGL_LIB.Math.getRotationQuat(angX, this.baseVectors.x);
    var rotQuatY = WEBGL_LIB.Math.getRotationQuat(angY, this.baseVectors.y);
    var rotQuatZ = WEBGL_LIB.Math.getRotationQuat(angZ, this.baseVectors.z);
    var rotQuat = rotQuatX.multQuaternion(rotQuatY.multQuaternion(rotQuatZ));
    this.transformations.localOrientation = rotQuat.multQuaternion(this.transformations.localOrientation);
    
};

//TODO: Ahould this be in math?
WEBGL_LIB.BaseObject.prototype.getRotationQuatXYZ = function(angX, angY, angZ){
    /*
     * Gets new rotation quaternion which performs rotations around X, Y and Z axes
     * by given rotation amount (angX, angY, angZ).
     */
    var rotQuatX = WEBGL_LIB.Math.getRotationQuat(angX, this.baseVectors.x);
    var rotQuatY = WEBGL_LIB.Math.getRotationQuat(angY, this.baseVectors.y);
    var rotQuatZ = WEBGL_LIB.Math.getRotationQuat(angZ, this.baseVectors.z);
    return rotQuatX.multQuaternion(rotQuatY.multQuaternion(rotQuatZ));
};

WEBGL_LIB.BaseObject.prototype.rotateWorld = function(angle, direction){
    //Rotate existing orientation by angle around given direction
    //Local rotation mult order: rot * local
    //Params: angle - rotation amount around defined axis in radians. Defaults to 0
    //        direction - direction around which the rotation is performed. Defaults to (0,0,0)
    
    var rotQuat = WEBGL_LIB.Math.getRotationQuat(angle, direction);
    this.transformations.worldOrientation = this.transformations.worldOrientation.multQuaternion(rotQuat);
};

WEBGL_LIB.BaseObject.prototype.rotateWorldXYZ = function(angX, angY, angZ){
    //Perform rotation on current orientation along base axes of local space
    //Params: angX - rotation around local X-axis
    //        angY - rotation around local Y-axis
    //        angZ - rotation around local Z-axis
   var rotQuatX = WEBGL_LIB.Math.getRotationQuat(angX, this.baseVectors.x);
   var rotQuatY = WEBGL_LIB.Math.getRotationQuat(angY, this.baseVectors.y);
   var rotQuatZ = WEBGL_LIB.Math.getRotationQuat(angZ, this.baseVectors.z);
   var rotQuat = rotQuatX.multQuaternion(rotQuatY.multQuaternion(rotQuatZ));
   this.transformations.worldOrientation = this.transformations.worldOrientation.multQuaternion(rotQuat);
    
};

WEBGL_LIB.BaseObject.prototype.translateWorldXYZ = function(trX, trY, trZ){
    //Perform translation along X-, Y and Z-axes.
    //Params: trX - translation along X-axis
    //        trY - translation along Y-axis
    //        trZ - translation along Z-axis
    this.transformations.location.x += trX;
    this.transformations.location.y += trY;
    this.transformations.location.z += trZ;
};

WEBGL_LIB.BaseObject.prototype.scaleXYZ = function(sclX, sclY, sclZ){
    //Perform rotation on current orientation along base axes of local space
    //Params: sclX - scale along X-axis
    //        sclY - scale along Y-axis
    //        sclZ - scale along Z-axis
    this.transformations.scale.x += sclX;
    this.transformations.scale.y += sclY;
    this.transformations.scale.z += sclZ;
};

WEBGL_LIB.BaseObject.prototype.getTransformationMatrix = function(){
    /*
     * Combine BaseObject.transformations -objects values into single transformation matrix that performs scale->rotation->translation in that order.
     */
    var transMat = WEBGL_LIB.Math.getTranslationMat4f(this.transformations.location.x, this.transformations.location.y, this.transformations.location.z);
    var rotQuat = this.transformations.localOrientation.multQuaternion(this.transformations.worldOrientation);
    var rotMat = rotQuat.getRotationMatrix();
    var sclMat = WEBGL_LIB.Math.getScaleMat4f(this.transformations.scale.x, this.transformations.scale.y, this.transformations.scale.z);
    return transMat.matrixMult(rotMat.matrixMult(sclMat));
};

WEBGL_LIB.MeshObject = function(loadedModel){
    /*
     * Mesh
     * Mesh object is used to create 3D objects that can be rendered by the renderer. 
     * Need to add the mesh to active renderer world to have the mesh rendered.
     * 
     */
    
    /*
     * Object members
     * 
     */
    
    WEBGL_LIB.BaseObject.call(this);
    //pointer to loadedModel on renderer
    this.model = loadedModel;
    
    //texture object is loaded texture of renderer, containing the image and the setup WebGLTexture-object
    this.textureObject = null;
    this.useTexture = false;
    
    this.surfaceProperties = {
        useLighting : true,
        specular:0.0,
        specularColor: new WEBGL_LIB.Math.Entities.Vector3f(0.0, 0.0, 0.0),
        surfaceColor : new WEBGL_LIB.Math.Entities.Vector3f(0.5, 0.5, 0.5)
    };
    
    //Mesh world should be set when it is added to some renderer. 
    //World is used to access the world and the renderer that the world belongs to.
    this.world = null;
    
    this.primitiveMode = "TRIANGLES";
    
    
};

WEBGL_LIB.MeshObject.prototype = Object.create(WEBGL_LIB.BaseObject.prototype);
WEBGL_LIB.MeshObject.constructor = WEBGL_LIB.MeshObject;

//MeshObject methods

WEBGL_LIB.MeshObject.prototype.setTexture = function(textureObj){
    this.textureObject = textureObj;
    this.useTexture = true;
};

WEBGL_LIB.MeshObject.prototype.setSurfaceColor = function(surfaceColor){
    this.surfaceProperties.surfaceColor = surfaceColor;
};

WEBGL_LIB.MeshObject.prototype.setSpecularReflection = function(specular, specularColor){
    this.surfaceProperties.specular = specular;
    this.surfaceProperties.specularColor = specularColor;
};

//camera properties
//Perspective projection settings
//fov, width, height, nearClip, farClip
//-field of view, 
//width of projected image/screen width, height of projected image/screen height, nearClip and farClip specify the visibility range of depth
//Camera settings
//forward - vector telling the direction camera looks at
WEBGL_LIB.CameraObject = function(properties){
    //TODO: Make multiple camera objects that have  different rotational properties, or can they all be done with same camera?
    WEBGL_LIB.BaseObject.call(this);
    /* DO WE NEED THIS?*/
    this.properties = properties;
    var p = properties;
    this.projectionMatrix = new WEBGL_LIB.Math.getPerspectiveProjMat4f(p.fov, p.width, p.height, p.nearClip, p.farClip);
    this.forward = this.baseVectors.z.clone();
    this.forward.negate();
    this.up = this.baseVectors.y.clone();
};
WEBGL_LIB.CameraObject.prototype = Object.create(WEBGL_LIB.BaseObject.prototype);
WEBGL_LIB.CameraObject.constructor = WEBGL_LIB.CameraObject;

WEBGL_LIB.CameraObject.prototype.resetProjection = function(){
    /*
     * Sets the projection matrix with the values stored in properties
     */
    var p = this.properties;
    this.projectionMatrix = new WEBGL_LIB.Math.getPerspectiveProjMat4f(p.fov, p.width, p.height, p.nearClip, p.farClip);
};

//CameraObject methods
WEBGL_LIB.CameraObject.prototype.getRight = function(){
    /*
     * Gets vector that is pointing right in cameras space
     */
    return this.forward.crossProduct(this.up);
};

WEBGL_LIB.CameraObject.prototype.rotateCamera = function(rotX, rotY){
    // To rotate around x axis correctly, we do the rotation around y on global axes, and the x around local axes
    // there was problem with rotations around x when facing x axis direction
    // camera behaves now like a fps camera, because when looking along y-axis, rotation
    var baseZ = this.baseVectors.z.clone();
    baseZ.negate();
    var baseY = this.baseVectors.y.clone();
    this.rotateLocalXYZ(rotX, 0, 0);
    this.rotateWorldXYZ(0, rotY, 0);
    var rotQuat = this.transformations.worldOrientation.multQuaternion(this.transformations.localOrientation);
    this.forward = baseZ.rotateWithQuaternion(rotQuat);
    this.up = baseY.rotateWithQuaternion(rotQuat);
};

WEBGL_LIB.CameraObject.prototype.translateCamera = function(dirVector, amount){
    /*
     * Transltes camera location vector to given direction by given amount.
     */
    var dir = dirVector.clone();
    dir.normalize();
    this.transformations.location = this.transformations.location.addVect(dir.mulScal(amount));
};


WEBGL_LIB.CameraObject.prototype.getCameraRotationMatrix = function(){
    /*
     * Constructs cameras rotation matrix using the forward and up vectors that are updated in cameraRotation function.
     * Gets the right vector, and places vectors so, that they represent the rotation that the axes make / describe the cameras axes orientation.
     */
    var u = this.up.clone();
    var f = this.forward.clone();
    u.normalize();
    f.normalize();
    var r = this.getRight();
    
    var matArray = [
        r.x, //m11
    	u.x, //m21
    	f.x, //m31
    	0.0, //m41
    	r.y, //m12
    	u.y, //m22
    	f.y, //m32
    	0.0, //m42
    	r.z, //m13
    	u.z, //m23
    	f.z, //m33
    	0.0, //m43
    	0.0, //m14
    	0.0, //m24
    	0.0, //m34
    	1.0 //m44
    ];
    return new WEBGL_LIB.Math.Entities.Matrix4f(matArray);
};

WEBGL_LIB.CameraObject.prototype.getCameraTranslationMatrix = function(){
    /*
     * Get cameras translation matrix.
     */
    return WEBGL_LIB.Math.getTranslationMat4f(-this.transformations.location.x, -this.transformations.location.y, -this.transformations.location.z);
};

WEBGL_LIB.PointLightObject = function(lightPosition, lightColor, lightLength){
    WEBGL_LIB.BaseObject.call(this);
    this.position = lightPosition ? lightPosition : new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0);
    this.lightColor = lightColor ? lightColor : new WEBGL_LIB.Math.Entities.Vector3f(0.0, 0.0, 0.0);
    this.lightLength = lightLength ? lightLength : 0.0;
};
WEBGL_LIB.PointLightObject.prototype = Object.create(WEBGL_LIB.BaseObject.prototype);
WEBGL_LIB.PointLightObject.constructor = WEBGL_LIB.PointLightObject;

WEBGL_LIB.SpotlightObject = function(lightPosition, lightColor, lightLength, target, angle, hardness){
    /*
     *  transformations.location - Each spotlight defines the position of spotlight in world with base objects transformations.locations vector
     *  lightColor - defines the light of light cast from light source
     *  lightLength defines the maximum distance from light source that the light is visible
     *  target - defines the location that the spotlight light source targets from its location.
     *  angle - defines the angle in which the spotlight is cast, forming a cone like are area
     *  hardness - defines the hardness of edges of the cast spot (intensity of light in edges of the spot lights cone area)
     */
    WEBGL_LIB.BaseObject.call(this);
    this.position = lightPosition ? lightPosition : new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0);
    this.lightColor = lightColor ? lightColor : new WEBGL_LIB.Math.Entities.Vector3f(0.0, 0.0, 0.0);
    this.lightLength = lightLength ? lightLength : 0.0;
    this.target = target ? target : new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0);
    this.angle = angle ? angle : 0.0;
    this.hardness = hardness ? hardness : 0;
    
};
WEBGL_LIB.SpotlightObject.prototype = Object.create(WEBGL_LIB.BaseObject.prototype);
WEBGL_LIB.SpotlightObject.constructor = WEBGL_LIB.SpotlightObject;

//global namespace for math functionalities
WEBGL_LIB.Math = {};

//Define entities
WEBGL_LIB.Math.Entities = {};

//TODO: MAKE Matrices and even vectors as arrys with custom length?
//requires some size checking in code before doing operations
WEBGL_LIB.Math.Entities.Vector3f = function(x, y, z){
		/*
		Class: Vector3f

		Desc:
			Class that represents 3-dimensional vector.
		Constructor params:
			x: value set to x-axis
			y: value set to y-axis
			z: value set to z-axis
		Member variables:
			x: represents vectors x-axis value
			y: represents vectors y-axis value
			z: represents vectors z-axis value
		*/
		this.x = x;
                this.y = y;
                this.z = z;
			
};

WEBGL_LIB.Math.Entities.Matrix3f = function(matrixArray){
    /*
	Class: Matrix4f

	Desc:
		Class that represents 4x4 matrix
	Constructor params:
		
	Member variables:
		matrix: 4x4 array containing float values
    */
    if(!matrixArray || matrixArray.length !== 9){
    	this.array = new Float32Array(9);
    	this.array[0] = 1.0; //m11
    	this.array[1] = 0.0; //m21
    	this.array[2] = 0.0; //m31
    	this.array[3] = 0.0; //m12
    	this.array[4] = 1.0; //m22
    	this.array[5] = 0.0; //m32
    	this.array[6] = 0.0; //m13
    	this.array[7] = 0.0; //m23
    	this.array[8] = 1.0; //m33
    }else{
    	this.array = new Float32Array(matrixArray);
    }
};

WEBGL_LIB.Math.Entities.Matrix4f = function(matrixArray){
    /*
	Class: Matrix4f

	Desc:
		Class that represents 4x4 matrix
	Constructor params:
		
	Member variables:
		matrix: 4x4 array containing float values
    */
    if(!matrixArray || matrixArray.length !== 16){
    	this.array = new Float32Array(16);
    	this.array[0] = 1.0; //m11
    	this.array[1] = 0.0; //m21
    	this.array[2] = 0.0; //m31
    	this.array[3] = 0.0; //m41
    	this.array[4] = 0.0; //m12
    	this.array[5] = 1.0; //m22
    	this.array[6] = 0.0; //m32
    	this.array[7] = 0.0; //m42
    	this.array[8] = 0.0; //m13
    	this.array[9] = 0.0; //m23
    	this.array[10] = 1.0; //m33
    	this.array[11] = 0.0; //m43
    	this.array[12] = 0.0; //m14
    	this.array[13] = 0.0; //m24
    	this.array[14] = 0.0; //m34
    	this.array[15] = 1.0; //m44
    }else{
    	this.array = new Float32Array(matrixArray);
    }
};

WEBGL_LIB.Math.Entities.Quaternion = function(w, vector3f){
	/*
	 * Class: Quaternion
	 * 
	 * Desc: Quaternion math entitiy. Has w component for rotation and vector3f for direction
	 */
	
	//1.0 equals 0 rotation around direction
	this.w = 1.0;
	this.vector = new WEBGL_LIB.Math.Entities.Vector3f(0.0, 0.0, 0.0);
	if(w){
		this.w = w;
	}
	
	if(vector3f){
		this.vector.x = vector3f.x;
                this.vector.y = vector3f.y;
                this.vector.z = vector3f.z;
	}
};

//TODO: Create helper functions for easier creation and handling

//define methods for Entity classes
//Vector3f methods

WEBGL_LIB.Math.Entities.Vector3f.prototype.clone = function(){
    return new WEBGL_LIB.Math.Entities.Vector3f(this.x, this.y, this.z);
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.getArray = function(){
                    return [this.x, this.y, this.z];
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.mulScal = function(scalar){
	/*
		Multiply scalar value given as parameter to this vector
		params - 
			scalar: scalar value (float, int) to be added
		return - 
			---
	*/
	var result = new WEBGL_LIB.Math.Entities.Vector3f(0,0,0);
        result.x = this.x*scalar;
        result.y = this.y*scalar;
        result.z = this.z*scalar;
        return result;
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.divScal = function(scalar){
	/*
		Divide scalar value given as parameter to this vector
		params - 
			scalar: scalar value (float, int) to be added
		return - 
			---
	*/
	var result = new WEBGL_LIB.Math.Entities.Vector3f(0,0,0);
        result.x = this.x/scalar;
        result.y = this.y/scalar;
        result.z = this.z/scalar;
        return result;
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.addVect = function(vector3f){
	/*
		Add vector given as parameter to this vector
		params - 
			vector3f: Vector3f to be added
		return - 
			---
	*/
	var result = new WEBGL_LIB.Math.Entities.Vector3f(0,0,0);
	if(vector3f instanceof WEBGL_LIB.Math.Entities.Vector3f){
		result.x = this.x+vector3f.x;
		result.y = this.y+vector3f.y;
		result.z = this.z+vector3f.z;
		return result;
	}
	else{
		console.error("Vector3f.addVect: Given parameter is not instace of Vector3f");
		return;
	}
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.subVect = function(vector3f){
	/*
		Substract vector given as parameter to this vector
		params - 
			vector3f: Vector3f to be added
		return - 
			---
	*/
	var result = new WEBGL_LIB.Math.Entities.Vector3f(0,0,0);
	if(vector3f instanceof WEBGL_LIB.Math.Entities.Vector3f){
		result.x = this.x-vector3f.x;
		result.y = this.y-vector3f.y;
		result.z = this.z-vector3f.z;
		return result;
	}
	else{
		console.error("Vector3f.subVect: Given parameter is not instace of Vector3f");
		return;
	}
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.dotProduct = function(vector3f){
	/*
		Returns result of calculated dot product beteween this and given parameter
		vector
		params - 
			Vector3f: Vector3f to be used in calculation
		return - 
			float: Scalar value representing the result of dot product
	*/
	if(vector3f instanceof WEBGL_LIB.Math.Entities.Vector3f){
		var result = this.x*vector3f.x + this.y*vector3f.y + this.z*vector3f.z;
		return result;
	}
	else{
		console.error("Vector3f.dotProduct: Given parameter is not instace of Vector3f");
		return;
	}
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.crossProduct = function(vector3f){
	/*
		Returns vector3f as result of calculated cross product beteween this and 
		given parameter vector
		params - 
			Vector3f: Vector3f to be used in calculation
		return - 
			Vector3f: Vector3f representing the result of cross product product
	*/
	if(vector3f instanceof WEBGL_LIB.Math.Entities.Vector3f){
		var new_x = this.y * vector3f.z - this.z * vector3f.y;
		var new_y = this.z * vector3f.x - this.x * vector3f.z;
		var new_z = this.x * vector3f.y - this.y * vector3f.x;
		return new WEBGL_LIB.Math.Entities.Vector3f(new_x, new_y, new_z);
	}
	else{
		console.error("Vector3f.crossProduct: Given parameter is not instace of Vector3f");
		return;
	}
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.length = function(){
	/*
		Returns length of this vector as scalar value
		params - 
			---
		return - 
			float: Length of this Vector3f
	*/
	var result = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	return result;
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.normalize = function(){
	/*
		Normalize this vector (set vector length to 1)
		params - 
			---
		return - 
			Vector3f - new norlaized vector from values of calling vector
	*/
	return this.divScal(this.length());
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.distance = function(vector3f){
	/*
		Returns scalar distance between this and given parameter vector
		params - 
			Vector3f: Vector3f to be used in calculation
		return - 
			float: Distance between vectors
	*/
	var new_vector = this.subVect(vector3f);
	return new_vector.length();
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.negate = function(){
	/*
	 * Sets values of vector to negative comapred to current values
	 * params -
	 * 	-
	 * return -
	 *  -
	 * 
	 * */
	this.x = -this.x;
	this.y = -this.y;
	this.z = -this.z;
}

//Matrix3f methods

WEBGL_LIB.Math.Entities.Matrix3f.prototype.mulScal = function(scalar){
    var result = new WEBGL_LIB.Math.Entities.Matrix3f();
    for(var i = 0; i < this.array.length; i++){
    	this.array[i] = this.array[i] * scalar;
    }
    return result;
};

WEBGL_LIB.Math.Entities.Matrix3f.prototype.matrixMult = function(mat3){
	
	/*
	 * Array index placements to matrix
	 * 
	 * 0  3  6
	 * 1  4  7
	 * 2  5  8
	 * 
	 * */
    var result = new WEBGL_LIB.Math.Entities.Matrix3f();
    
    if(mat3 instanceof WEBGL_LIB.Math.Entities.Matrix3f){
    	result.array[0] = this.array[0] * mat3.array[0] + this.array[3] * mat3.array[1] + this.array[6] * mat3.array[2]; //m11
        result.array[1] = this.array[1] * mat3.array[0] + this.array[4] * mat3.array[1] + this.array[7] * mat3.array[2]; //m21
        result.array[2] = this.array[2] * mat3.array[0] + this.array[5] * mat3.array[1] + this.array[8] * mat3.array[2]; //m31
        result.array[3] = this.array[0] * mat3.array[3] + this.array[3] * mat3.array[4] + this.array[6] * mat3.array[5]; //m12
        result.array[4] = this.array[1] * mat3.array[3] + this.array[4] * mat3.array[4] + this.array[7] * mat3.array[5]; //m22
    	result.array[5] = this.array[2] * mat3.array[3] + this.array[5] * mat3.array[4] + this.array[8] * mat3.array[5]; //m32
    	result.array[6] = this.array[0] * mat3.array[6] + this.array[3] * mat3.array[7] + this.array[6] * mat3.array[8]; //m13
    	result.array[7] = this.array[1] * mat3.array[6] + this.array[4] * mat3.array[7] + this.array[7] * mat3.array[8]; //m23
    	result.array[8] = this.array[2] * mat3.array[6] + this.array[5] * mat3.array[7] + this.array[8] * mat3.array[8]; //m33

    }else{
    	console.log("Can't multiply Matrix4f with other than Matrix4f. Tried to multiply with:");
    	console.log(mat3);
    }
    
    return result;
};

WEBGL_LIB.Math.Entities.Matrix3f.prototype.transposeMatrix = function(){
	var a = this.array;
	return new WEBGL_LIB.Math.Entities.Matrix3f([a[0],a[3],a[6],a[1],a[4],a[7],a[2],a[5],a[8]]);
};

WEBGL_LIB.Math.Entities.Matrix3f.prototype.adjointMatrix = function(){
	var a = this.array;
	var resultArray = [];
	resultArray.push( a[4]*a[8]-a[7]*a[5]); 	//+Cof 11
	resultArray.push(-(a[3]*a[8]-a[6]*a[5]));	//-Cof 21
	resultArray.push( a[3]*a[7]-a[6]*a[4]); 	//+Cof 31
	resultArray.push(-(a[1]*a[8]-a[7]*a[2])); 	//-Cof 12
	resultArray.push( a[0]*a[8]-a[6]*a[2]); 	//+Cof 22
	resultArray.push(-(a[0]*a[7]-a[6]*a[1])); 	//-Cof 32
	resultArray.push( a[1]*a[5]-a[4]*a[2]); 	//+Cof 13
	resultArray.push(-(a[0]*a[5]-a[3]*a[2])); 	//-Cof 23
	resultArray.push( a[0]*a[4]-a[3]*a[1]); 	//+Cof 33
	
	return new WEBGL_LIB.Math.Entities.Matrix3f(resultArray).transposeMatrix();
};

WEBGL_LIB.Math.Entities.Matrix3f.prototype.determinant = function(){
	
	/*
	 * Array index placements to matrix
	 * 
	 * 0  3  6
	 * 1  4  7
	 * 2  5  8
	 * 
	 * */
	var a = this.array;
	
	return a[0]*a[4]*a[8] + a[3]*a[7]*a[2] + a[6]*a[1]*a[5] - a[0]*a[7]*a[5] - a[3]*a[1]*a[8] - a[6]*a[4]*a[2];

};

WEBGL_LIB.Math.Entities.Matrix3f.prototype.inverseMatrix = function(){
	var adjMat = new WEBGL_LIB.Math.Entities.Matrix3f(this.array).adjointMatrix();
	var det = this.determinant();
	adjMat.mulScal(1/det); //mutliplying adjmatrix with 1/determiant causes it to become inverse of this matrix
	return adjMat;
};

WEBGL_LIB.Math.Entities.Matrix3f.prototype.multVec3 = function(vector3f){
    var result = new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0);
    result.x = vector3f.x * this.array[0] + vector3f.y * this.array[3] + vector3f.z * this.array[6];
    result.y = vector3f.x * this.array[1] + vector3f.y * this.array[4] + vector3f.z * this.array[7];
    result.z = vector3f.x * this.array[2] + vector3f.y * this.array[5] + vector3f.z * this.array[8];
    return result;
};

//Matrix4f methods

WEBGL_LIB.Math.Entities.Matrix4f.prototype.get3x3Matrix = function(){
	var a = this.array;
	return new WEBGL_LIB.Math.Entities.Matrix3f([a[0],a[1],a[2],a[4],a[5],a[6],a[8],a[9],a[10]]);
};

WEBGL_LIB.Math.Entities.Matrix4f.prototype.mulScal = function(scalar){
    var result = new WEBGL_LIB.Math.Entities.Matrix4f();
    for(var i = 0; i < this.array.length; i++){
    	this.array[i] = this.array[i] * scalar;
    }
    return result;
};

WEBGL_LIB.Math.Entities.Matrix4f.prototype.matrixMult = function(mat4){
    var result = new WEBGL_LIB.Math.Entities.Matrix4f();
    
    if(mat4 instanceof WEBGL_LIB.Math.Entities.Matrix4f){
    	result.array[0] = this.array[0] * mat4.array[0] + this.array[4] * mat4.array[1] + this.array[8] * mat4.array[2] + this.array[12] * mat4.array[3]; //m11
        result.array[1] = this.array[1] * mat4.array[0] + this.array[5] * mat4.array[1] + this.array[9] * mat4.array[2] + this.array[13] * mat4.array[3]; //m21
        result.array[2] = this.array[2] * mat4.array[0] + this.array[6] * mat4.array[1] + this.array[10] * mat4.array[2] + this.array[14] * mat4.array[3]; //m31
        result.array[3] = this.array[3] * mat4.array[0] + this.array[7] * mat4.array[1] + this.array[11] * mat4.array[2] + this.array[15] * mat4.array[3]; //m41
        result.array[4] = this.array[0] * mat4.array[4] + this.array[4] * mat4.array[5] + this.array[8] * mat4.array[6] + this.array[12] * mat4.array[7]; //m12
    	result.array[5] = this.array[1] * mat4.array[4] + this.array[5] * mat4.array[5] + this.array[9] * mat4.array[6] + this.array[13] * mat4.array[7]; //m22
    	result.array[6] = this.array[2] * mat4.array[4] + this.array[6] * mat4.array[5] + this.array[10] * mat4.array[6] + this.array[14] * mat4.array[7]; //m32
    	result.array[7] = this.array[3] * mat4.array[4] + this.array[7] * mat4.array[5] + this.array[11] * mat4.array[6] + this.array[15] * mat4.array[7]; //m42
    	result.array[8] = this.array[0] * mat4.array[8] + this.array[4] * mat4.array[9] + this.array[8] * mat4.array[10] + this.array[12] * mat4.array[11]; //m13
    	result.array[9] = this.array[1] * mat4.array[8] + this.array[5] * mat4.array[9] + this.array[9] * mat4.array[10] + this.array[13] * mat4.array[11]; //m23
    	result.array[10] = this.array[2] * mat4.array[8] + this.array[6] * mat4.array[9] + this.array[10] * mat4.array[10] + this.array[14] * mat4.array[11]; //m33
    	result.array[11] = this.array[3] * mat4.array[8] + this.array[7] * mat4.array[9] + this.array[11] * mat4.array[10] + this.array[15] * mat4.array[11]; //m43
    	result.array[12] = this.array[0] * mat4.array[12] + this.array[4] * mat4.array[13] + this.array[8] * mat4.array[14] + this.array[12] * mat4.array[15]; //m14
    	result.array[13] = this.array[1] * mat4.array[12] + this.array[5] * mat4.array[13] + this.array[9] * mat4.array[14] + this.array[13] * mat4.array[15]; //m24
    	result.array[14] = this.array[2] * mat4.array[12] + this.array[6] * mat4.array[13] + this.array[10] * mat4.array[14] + this.array[14] * mat4.array[15]; //m34
    	result.array[15] = this.array[3] * mat4.array[12] + this.array[7] * mat4.array[13] + this.array[11] * mat4.array[14] + this.array[15] * mat4.array[15]; //m44
    }else{
    	console.log("Can't multiply Matrix4f with other than Matrix4f. Tried to multiply with:");
    	console.log(mat4);
    }
    
    return result;
};

WEBGL_LIB.Math.Entities.Matrix4f.prototype.determinant = function(){
	
	/*
	 * Array index placements to matrix
	 * 
	 * 0  4  8  12
	 * 1  5  9  13
	 * 2  6  10 14
	 * 3  7  11 15
	 * 
	 * */
	var result = new WEBGL_LIB.Math.Entities.Matrix4f(this.array);
	//TODO: Use matrix3f determinant to calculate determinant
	return result;
};

WEBGL_LIB.Math.Entities.Matrix4f.matrixInverse = function(){
	var result = new WEBGL_LIB.Math.Entities.Matrix4f(this.array);
	//TODO: Finish determinant and adjoint to create this.
};

WEBGL_LIB.Math.angleToRadians = function(angle){
    return (angle*(Math.PI/180.0));
};

WEBGL_LIB.Math.radiansToAngle = function(rad){
    return (rad*(180.0/Math.PI));
};

WEBGL_LIB.Math.getXRotationMat4f = function(rotationAngle){
	var rotationRad = rotationAngle * (Math.PI/180.0);
	var rotMat4 = new WEBGL_LIB.Math.Entities.Matrix4f([
	                                           1, 0, 0, 0, 
	                                           0, Math.cos(rotationRad), -Math.sin(rotationRad), 0,
	                                           0, Math.sin(rotationRad), Math.cos(rotationRad), 0,
	                                           0, 0, 0, 1 ]);
	return rotMat4;
};

WEBGL_LIB.Math.getYRotationMat4f = function(rotationAngle){
	var rotationRad = rotationAngle * (Math.PI/180.0);
	var rotMat4 = new WEBGL_LIB.Math.Entities.Matrix4f([
	                                           Math.cos(rotationRad),0, Math.sin(rotationRad), 0,
	                                           0, 1, 0, 0,
	                                           -Math.sin(rotationRad), 0, Math.cos(rotationRad), 0,
	                                           0, 0, 0, 1 ]);
	return rotMat4;
};

WEBGL_LIB.Math.getZRotationMat4f = function(rotationAngle){
	var rotationRad = rotationAngle * (Math.PI/180.0);
	var rotMat4 = new WEBGL_LIB.Math.Entities.Matrix4f([
	                                           Math.cos(rotationRad), -Math.sin(rotationRad), 0, 0, 
	                                           Math.sin(rotationRad), Math.cos(rotationRad), 0, 0,
	                                           0, 0, 1, 0,
	                                           0, 0, 0, 1 ]);
	return rotMat4;
};

WEBGL_LIB.Math.getScaleMat4f = function(sx, sy, sz){
	var scaleMat4 = new WEBGL_LIB.Math.Entities.Matrix4f([
	                                          sx, 0, 0, 0,
	                                          0, sy, 0, 0,
	                                          0, 0, sz, 0,
	                                          0, 0, 0, 1 ]);
	return scaleMat4;
};

WEBGL_LIB.Math.getTranslationMat4f = function(x, y, z){
	var transMat4 = new WEBGL_LIB.Math.Entities.Matrix4f([
	                                           1, 0, 0, 0, 
	                                           0, 1, 0, 0,
	                                           0, 0, 1, 0,
	                                           x, y, z, 1 ]);
	return transMat4;
};

WEBGL_LIB.Math.getTranslationMat4fAlongDirection = function(direction, amount){
    var transMat4 = new WEBGL_LIB.Math.Entities.Matrix4f([
	                                           1, 0, 0, 0, 
	                                           0, 1, 0, 0,
	                                           0, 0, 1, 0,
	                                           direction.x*amount, direction.y*amount, direction.z*amount, 1 ]);
    return transMat4;
};

WEBGL_LIB.Math.getPerspectiveProjMat4f = function(fov, width, height, nearClip, farClip){
	var halfFov = Math.tan((fov/2) * (Math.PI/180.0)); //distance to center from screen border
	var aspectRatio = height/width; //screen aspect
	var clipRange = nearClip - farClip;
	var projMat4 = new WEBGL_LIB.Math.Entities.Matrix4f([
	                                           1.0 * (halfFov * aspectRatio), 0, 0, 0,
	                                           0, 1.0 * (halfFov), 0, 0,
	                                           0, 0, (-nearClip - farClip)/clipRange, 1,
	                                           0, 0, 2 * farClip * nearClip / clipRange, 0 ]);
	return projMat4;
};

//QUATERNION OPERATIONS

WEBGL_LIB.Math.Entities.Quaternion.prototype.quaternionLenght = function(){
    var v = this.vector;
    return Math.sqrt(this.w * this.w + v.x * v.x + v.y * v.y + v.z * v.z);
};

WEBGL_LIB.Math.Entities.Quaternion.prototype.normalize = function(){
    var length = this.quaternionLenght();
    this.vector.x /= length;
    this.vector.y /= length;
    this.vector.z /= length;
    this.w /= length;
};

WEBGL_LIB.Math.Entities.Quaternion.prototype.getConjugateQuaternion = function(){
	return new WEBGL_LIB.Math.Entities.Quaternion(this.w, new WEBGL_LIB.Math.Entities.Vector3f(-this.vector.x,-this.vector.y,-this.vector.z));
};

WEBGL_LIB.Math.Entities.Quaternion.prototype.addQuaternion = function(quaternion){
	//Add another quaternion given as parameter to this quaternion
	//using formula (w1 + w2, vec1 + vec2)
        var result = new WEBGL_LIB.Math.Entities.Quaternion();
	result.w = this.w + quaternion.w;
	result.vector = this.vector.addVect(quaternion.vector);
        return result;
};

WEBGL_LIB.Math.Entities.Quaternion.prototype.multQuaternion = function(quaternion){
	//Multiply this quaternion with a another quaternion
	//Using formula (w1 * w2 - vector1 (dot) vector2, w1 * vector2 + w2 * vector1 + vector1 (cross) vector2
        var newW = this.w * quaternion.w - this.vector.dotProduct(quaternion.vector);
        var v1 = quaternion.vector.mulScal(this.w);
        var v2 = this.vector.mulScal(quaternion.w);
        var v3 = this.vector.crossProduct(quaternion.vector);
        var newVec = v1.addVect(v2.addVect(v3));
        
        return new WEBGL_LIB.Math.Entities.Quaternion(newW, newVec);
};

WEBGL_LIB.Math.Entities.Quaternion.prototype.multVector = function(vector3f){
    var vec = new WEBGL_LIB.Math.Entities.Vector3f(0, 0, 0);
    var w = -this.vector.x * vector3f.x - this.vector.y * vector3f.y - this.vector.z * vector3f.z;
    vec.x = this.w * vector3f.x + this.vector.y * vector3f.z - this.vector.z * vector3f.y;
    vec.y = this.w * vector3f.y + this.vector.z * vector3f.x - this.vector.x * vector3f.z;
    vec.z = this.w * vector3f.z + this.vector.x * vector3f.y - this.vector.y * vector3f.x;
    return new WEBGL_LIB.Math.Entities.Quaternion(w, vec);
};

WEBGL_LIB.Math.Entities.Quaternion.prototype.getRotationMatrix = function(){
    var x = this.vector.x;
    var y = this.vector.y;
    var z = this.vector.z;
    var w = this.w;
    var pX = (x * x);
    var pY = (y * y);
    var pZ = (z * z);
    
    var mat4Array = [
        1 - 2 * pY - 2 * pZ,     //m11
        2 * x * y - 2 * w * z,   //m21
        2 * x * z + 2 * w * y,   //m31
        0,                       //m41
        2 * x * y  + 2 * w * z,  //m12
        1 - 2 * pX - 2 * pZ,     //m22
        2 * y * z - 2 * w * x,   //m32
        0,                       //m42
        2 * x * z - 2 * w * y,   //m13
        2 * y * z + 2 * w * x,   //m23
        1 - 2 * pX - 2 * pY,     //m33
        0,                       //m43
        0,                       //m14
        0,                       //m24
        0,                       //m34
        1                        //m44
    ];
    
    return new WEBGL_LIB.Math.Entities.Matrix4f(mat4Array);
};

WEBGL_LIB.Math.getRotationQuat = function(angle, axisVector){
    /*
     * Construct a rotation quaternion, that rotates by angle around the direction given.
     * Returns the normalized quaternion that performs defined rotation.
     */
    axisVector.normalize();
    var rot = angle ? angle / 2 : 0;
    var qX = axisVector.x * (Math.sin(rot));
    var qY = axisVector.y * (Math.sin(rot));
    var qZ = axisVector.z * (Math.sin(rot));
    var qW = Math.cos(rot);
    var rotQuat = new WEBGL_LIB.Math.Entities.Quaternion(qW, new WEBGL_LIB.Math.Entities.Vector3f(qX, qY, qZ));
    rotQuat.normalize();
    return rotQuat;
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.rotateVectorAroundAxis = function(angle, axisVector){
    axisVector.normalize();
    var rad = WEBGL_LIB.Math.angleToRadians(angle/2);
    var qX = axisVector.x * (Math.sin(rad));
    var qY = axisVector.y * (Math.sin(rad));
    var qZ = axisVector.z * (Math.sin(rad));
    var qW = Math.cos(rad);
    var rotQuat = new WEBGL_LIB.Math.Entities.Quaternion(qW, new WEBGL_LIB.Math.Entities.Vector3f(qX, qY, qZ));
    var rotConj = rotQuat.getConjugateQuaternion();
    var resultQuat = rotQuat.multVector(this).multQuaternion(rotConj);
    return new WEBGL_LIB.Math.Entities.Vector3f(resultQuat.vector.x, resultQuat.vector.y, resultQuat.vector.z);
};

WEBGL_LIB.Math.Entities.Vector3f.prototype.rotateWithQuaternion= function(rotQuat){
    var rotConj = rotQuat.getConjugateQuaternion();
    var vQuat = new WEBGL_LIB.Math.Entities.Quaternion(0, this.clone());
    //var q1 = rotQuat.multVector(this);
    var q1 = rotQuat.multQuaternion(vQuat);
    var resultQuat = q1.multQuaternion(rotConj);
    return new WEBGL_LIB.Math.Entities.Vector3f(resultQuat.vector.x, resultQuat.vector.y, resultQuat.vector.z);
};