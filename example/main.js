System.register(["imgui-js", "./imgui_impl", "imgui-js/imgui_demo", "imgui-js/imgui_memory_editor", "./test"], function (exports_1, context_1) {
    "use strict";
    var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    var ImGui, ImGui_Impl, imgui_js_1, imgui_js_2, imgui_demo_1, imgui_memory_editor_1, font, show_demo_window, show_another_window, clear_color, memory_editor, show_sandbox_window, show_gamepad_window, show_movie_window, f, counter, done, source, image_urls, image_url, image_element, image_gl_texture, video_urls, video_url, video_element, video_gl_texture, video_w, video_h, video_time_active, video_time, video_duration, annotating_active, num_landmarks, upload_images, all_datasets, current_dataset, all_images, current_image, dataset_name, deleting_dataset, hal_image, current_texture_image, current_ocrs, current_ocr_idx, current_landmarks, current_landmark_idx, current_boxes, drag_status, frame_updated, image_scale, scale_image_to_window, _static, Static;
    var __moduleName = context_1 && context_1.id;
    function LoadArrayBuffer(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(url);
            return response.arrayBuffer();
        });
    }
    
    // **************************************************************
    // Functions that abstract several of the image stuff.
    //
    // You can create a TextureImage with the URL and a gl reference.
    // Then you can get its pixels to draw as you want, and then
    // you must call UpdateTexture so that we can send those
    // modifications back to the OpenGL texture.
    // **************************************************************
    function TextureImage(url, gl) {
        this.width = 8;
        this.height = 8;
        this.gl_texture = gl.createTexture();
        var image_element;
        this.image = image_element = new Image();

        this.pixels = new Uint8Array(4 * this.width * this.height);
        gl.bindTexture(gl.TEXTURE_2D, this.gl_texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
        this.image.crossOrigin = "anonymous";
        var self = this;
        this.image.addEventListener("load", (event) => {
            self.width = image_element.naturalWidth;
            self.height = image_element.naturalHeight;            
        
            // Now that the image is loaded, update self.pixels to have the
            // original image
            gl.bindTexture(gl.TEXTURE_2D, self.gl_texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image_element);

            var framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.gl_texture, 0);

            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) == gl.FRAMEBUFFER_COMPLETE)
            {
                var sTextureSize = self.width * self.height * 4;    // r, g, b, a
                self.pixels = new Uint8Array( sTextureSize );
                var pixels2 = new Uint8Array( sTextureSize );
                gl.readPixels( 0, 0, self.width, self.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels2 );
                for (var i=0; i<sTextureSize; i++)
                    self.pixels[i] = pixels2[i];
            }

            gl.deleteFramebuffer(framebuffer);
        });
        this.image.src = url;
    }

    // This is slow! Call only once before all the texture updates
    function GetOriginalPixels(textureImage) {
        return textureImage.pixels.slice();
    }

    function DrawPoint(textureImage, pixels, x, y, canvasWidth, canvasHeight, ptSize, scalePointPosition) {
        var scale_x = textureImage.width / canvasWidth;
        var scale_y = textureImage.height / canvasHeight;

        var pt_size_x = Math.round(ptSize*scale_x);
        var pt_size_y = Math.round(ptSize*scale_y);
        
        if (scalePointPosition == false) {
            scale_x = scale_y = 1;
        }
        
        x = Math.round(x*scale_x);
        y = Math.round(y*scale_y);
        if (x<0 || y<0) return;

        for (var i=y-pt_size_y; i<y+pt_size_y; i++) {
            for (var j=x-pt_size_x; j<x+pt_size_x; j++) {
                if (i<=0 || i>=textureImage.height || j<0 || j>= textureImage.width)
                    continue;
                var idx = i*textureImage.width*4+j*4
                pixels[idx+0] = 200;
                pixels[idx+1] = 0;
                pixels[idx+2] = 0;
            }
        }
    }

    function DrawThinLine (x1, y1, x2, y2, pixels, width, height, canvasWidth, canvasHeight) {
        var scale_x = width / canvasWidth;
        var scale_y = height / canvasHeight;
        if (canvasWidth < 0 || canvasHeight < 0) {
            scale_x = scale_y = 1;
        }
        
        x1 = Math.round(x1*scale_x);
        y1 = Math.round(y1*scale_y);
        x2 = Math.round(x2*scale_x);
        y2 = Math.round(y2*scale_y);
        // if (x1 < 0 || y1 < 0 || x1 >= width || y1 >= height)
        //     return;
        var dx = Math.abs(x2 - x1);
        var dy = Math.abs(y2 - y1);
        var sx = (x1 < x2) ? 1 : -1;
        var sy = (y1 < y2) ? 1 : -1;
        var err = dx - dy;
        var idx = 0;
        // Main loop
        while (!((x1 == x2) && (y1 == y2))) {
            var e2 = err << 1;
            if (e2 > -dy) {
              err -= dy;
              x1 += sx;
            }
            if (e2 < dx) {
              err += dx;
              y1 += sy;
            }
            // ignore coordinates that fall outside of image 
            if (x1 < 0 || y1 < 0 || x1 >= width || y1 >= height)
                continue
            idx = y1*width*4 + x1*4;
            pixels[idx+0] = 0;
            pixels[idx+1] = 0;
            pixels[idx+2] = 200;
        }
    }


    // http://members.chello.at/~easyfilter/bresenham.html
    function DrawLine (x0, y0, x1, y1, pixels, textureImage, canvasWidth, canvasHeight, wd)
    { 
        var dx = Math.abs(x1-x0);
        var sx = x0 < x1 ? 1 : -1; 
        var dy = Math.abs(y1-y0)
        var sy = y0 < y1 ? 1 : -1; 
        var err = dx-dy
        var e2;
        var x2;
        var y2;
        var ed = dx+dy == 0 ? 1.0 : Math.sqrt(dx*dx+dy*dy);

        x0 = Math.round(x0);
        x1 = Math.round(x1);
        y0 = Math.round(y0);
        y1 = Math.round(y1);

        var width = textureImage.width;
        var height = textureImage.height;
        
        var scale = width / canvasWidth;
        wd = Math.round(wd*scale);
      
        var num_iter=0;
        wd = (wd+1)/2; 
        while (true) {
            num_iter += 1;
            // if (num_iter > 4000) break;
            var idx = Math.round(y0)*width*4 + Math.round(x0)*4;
            var alpha = Math.round(Math.max(0,255*(Math.abs(err-dx+dy)/ed-wd+1)));
            pixels[idx+0] = 0;
            pixels[idx+1] = 0;
            pixels[idx+2] = 200;
            // pixels[idx+3] = alpha;
            e2 = err; x2 = x0;
            if (2*e2 >= -dx) {                                           /* x step */
                e2 += dy;
                y2 = y0;
                while (e2 < ed*wd && (y1 != y2 || dx > dy)) {
                // for (e2 += dy, y2 = y0; e2 < ed*wd && (y1 != y2 || dx > dy); e2 += dx) {
                    y2 = y2+sy;
                    idx = Math.round(y2)*width*4 + Math.round(x0)*4;
                    // alpha = Math.round(Math.max(0,255*(Math.abs(e2)/ed-wd+1)));
                    pixels[idx+0] = 0;
                    pixels[idx+1] = 0;
                    pixels[idx+2] = 200;
                    // pixels[idx+3] = alpha;
                    e2 += dx;
                }
                if (x0 == x1) break;
                e2 = err; err -= dy; x0 += sx; 
            } 
            if (2*e2 <= dy) {                                            /* y step */
                e2 = dx-e2;
                // TODO: fix this buggy while...
                // while (e2 < ed*wd && (x1 != x2 || dx < dy) && count < 1) {
                // // for (e2 = dx-e2; e2 < ed*wd && (x1 != x2 || dx < dy); e2 += dy) {
                //     x2 = x2+sx;
                //     idx = Math.round(y0)*width*4 + Math.round(x2)*4;
                //     alpha = Math.round(Math.max(0,255*(Math.abs(e2)/ed-wd+1)));
                //     pixels[idx+0] = 0;
                //     pixels[idx+1] = 0;
                //     pixels[idx+2] = 200;
                //     pixels[idx+3] = alpha;
                //     e2 += dy;
                // }
                if (y0 == y1) break;
                err += dx; y0 += sy; 
            }
        }
    }

    function UpdateTexture(textureImage, pixels, gl) {
        gl.bindTexture(gl.TEXTURE_2D, textureImage.gl_texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
                      textureImage.width, textureImage.height, 0,
                      gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }


    // **************************************************************
    // Functions that manage the images and datasets
    // **************************************************************


    function Box(x1, y1, x2, y2, x3, y3, x4, y4, id, label) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.x3 = x3;
        this.y3 = y3;
        this.x4 = x4;
        this.y4 = y4;
        this.id = id;
        this.label = label;
    }

    function Landmark(x, y, label) {
        this.x = x;
        this.y = y;
        this.label = label;
    }

    function OCR(ocr, box_id, box_idx) {
        this.ocr = ocr;
        this.box_id = box_id;
        this.box_idx = box_idx;
        this.image = null;
    }

    function DraggingStatus() {
        this.dragging = false;
        this.im_idx = 0;
        this.landmark_idx=-1;
        this.landmark_pt_idx=-1;
        this.dx = 0;
        this.dy = 0;
    }


    function BoxesFromAnnotation() {
        var anno = [];
        for (let i=0; i<all_images[current_image]['boxes'].length; i++) {
            anno.push( new Box(all_images[current_image]['boxes'][i]['x1'],
                               all_images[current_image]['boxes'][i]['y1'],
                               all_images[current_image]['boxes'][i]['x2'],
                               all_images[current_image]['boxes'][i]['y2'],
                               all_images[current_image]['boxes'][i]['x3'],
                               all_images[current_image]['boxes'][i]['y3'],
                               all_images[current_image]['boxes'][i]['x4'],
                               all_images[current_image]['boxes'][i]['y4'],
                               all_images[current_image]['boxes'][i]['id'],
                               all_images[current_image]['boxes'][i]['label']) );
        }

        return anno;
    }

    function OCRsFromAnnotation(boxes) {
        var anno = [];
        for (let i=0; i<all_images[current_image]['ocrs'].length; i++) {
            var box_id = all_images[current_image]['ocrs'][i]['box_id'].toString();
            var box_idx = -1;
            for (let j=0; j<boxes.length; j++) {
                if (box_id == boxes[i].id) {
                    box_idx = j;
                }
            }

            anno.push(new OCR(all_images[current_image]['ocrs'][i]['ocr'], box_id, box_idx));
        }

        return anno;
    }

    function LandmarksFromAnnotation() {
        var anno = [];
        for (let i=0; i<all_images[current_image]["landmarks"].length; i++) {
            var curr_lands = []
            for (let j=0; j<all_images[current_image]["landmarks"][i]["points"].length; j++) {
                curr_lands.push( new Landmark(all_images[current_image]["landmarks"][i]["points"][j]["x"],
                                              all_images[current_image]["landmarks"][i]["points"][j]["y"],
                                              all_images[current_image]["landmarks"][i]["label"]) );
            }
            anno.push(curr_lands);
        }
        return anno;
    }

    function UpdateAnnotation(boxes, landmarks) {
        all_images[current_image]["boxes"] = []
        for (let i=0; i<boxes.length; i++) {
            var box = {};
            box["x1"] = boxes[i].x1;
            box["y1"] = boxes[i].y1;
            box["x2"] = boxes[i].x2;
            box["y2"] = boxes[i].y2;
            box["x3"] = boxes[i].x3;
            box["y3"] = boxes[i].y3;
            box["x4"] = boxes[i].x4;
            box["y4"] = boxes[i].y4;
            box["label"] = boxes[i].label;
            all_images[current_images]["boxes"].push(box);
        }

        all_images[current_image]["landmarks"] = []
        for (let i=0; i<landmarks.length; i++) {
            var land = [];
            for (let j=0; j<landmarks[i].length; j++) {
                var pt = {};
                pt["x"] = landmarks[i][j].x;
                pt["y"] = landmarks[i][j].y;
                land.push(pt);
            }
            var land_anno = {};
            land_anno["label"] = landmarks[i].label;
            land_anno["points"] = land;
            all_images[current_image]["landmarks"].push(land_anno);
        }
    }


    function UpdateDraggingAnno(drag_status, x, y) {
        if (drag_status.landmark_idx < 0 || drag_status.landmark_idx >= current_landmarks.length) {
            return false;
        }

        var land_idx = drag_status.landmark_idx;
        var pt_idx = drag_status.landmark_pt_idx;
        current_landmarks[land_idx][pt_idx].x = x;
        current_landmarks[land_idx][pt_idx].y = y;
        return true;
    }


    function GetClosestLandmark(x, y, radius) {
        var best_land_id = -1;
        var best_land_pt_id = -1;
        var best_land_dist = 10000;

        for (let i=0; i<current_landmarks.length; i++) {
            for (let j=0; j<current_landmarks[i].length; j++) {
                var dist = Math.sqrt((current_landmarks[i][j].x-x)*(current_landmarks[i][j].x-x)+(current_landmarks[i][j].y-y)*(current_landmarks[i][j].y-y));
                if (dist < radius && dist < best_land_dist) {
                    best_land_dist = dist;
                    best_land_id = i;
                    best_land_pt_id = j;
                }
            }
        }
        return [best_land_id, best_land_pt_id];
    }

    function LoadDatasets() {
        const Http = new XMLHttpRequest();
        const url='http://192.168.1.42:8094/annotator_supreme/dataset/all';
        Http.responseType = 'json';
        Http.open("GET", url, true);
        Http.send();
        Http.onload=(e)=>{
            all_datasets = Http.response['datasets'];
            console.log(all_datasets);
        }
    }

    function UploadImages(datasetId, imagesList, idx) {
        var image = imagesList[idx];
        idx += 1;

        const Http = new XMLHttpRequest();
        const url='http://192.168.1.42:8094/annotator_supreme/annotation/'+datasetId;
        Http.open("POST", url, true);
        
        var formData = new FormData();
        formData.append("image", image);
        Http.send(formData);
        Http.onload=(e)=>{
            if (idx < imagesList.length) {
                UploadImages(datasetId, imagesList, idx);
            }
        }
    }
    function LoadCurrentImage() {
        // TODO: Am I leaking gl textures? And if so, is it thaaaat bad?
        // if (current_texture_image) {
        //     DeleteTextureImage(current_texture_image);
        // }
        if (current_image >= all_images.length) {
            current_texture_image = null;
            console.log("Invalid image to load", current_image);
            return;
        }

        const gl = ImGui_Impl.gl;
        var url = "http://192.168.1.42:8094/annotator_supreme/";
        current_texture_image = new TextureImage(url+all_images[current_image]['image_url'], gl);

        current_boxes = BoxesFromAnnotation();
        current_ocrs = [];//OCRsFromAnnotation(current_boxes);
        current_landmarks = LandmarksFromAnnotation();
        current_landmark_idx = current_landmarks.length;
        current_landmarks.push([]);
        frame_updated = true;
    }

    function LoadImages() {
        var id = all_datasets[current_dataset]["id"].toString();
           
        current_image = -1;
        const Http = new XMLHttpRequest();
        const url='http://192.168.1.42:8094/annotator_supreme/annotation/'+id+'/all';
        Http.responseType = 'json';
        Http.open("GET", url, true);
        Http.send();
        Http.onload=(e)=>{
            all_images = Http.response['annotations'];
            current_image = 0;
            LoadCurrentImage();
        }
    }

    function UploadAnnotations() {
        if (current_image < 0 || current_image >= all_images.length)
            return;

        var id_dataset = all_datasets[current_dataset]["id"].toString();
        var id = all_images[current_image]["id"].toString();
        UpdateAnnotation(current_boxes, current_landmarks);
        const Http = new XMLHttpRequest();
        const url='http://192.168.1.42:8094/annotator_supreme/annotation/'+id_dataset+'/'+id;
        Http.open("PATCH", url, true);
        
        var data = {}
        data.ocrs = [];
        data.boxes = [];
        data.landmarks = [];

        for (let i=0; i<current_landmarks.length; i++) {
            var curr_land = {}
            if (current_landmarks[i].length == 0)
                continue;

            curr_land["label"] = "";
            curr_land["points"] = []
            for (let j=0; j<current_landmarks[i].length; j++) {
                var pt = {}
                pt["x"] = current_landmarks[i][j].x;
                pt["y"] = current_landmarks[i][j].y;
                curr_land["points"].push(pt);
            }
            data.landmarks.push(curr_land);
        }

        for (let i=0; i<current_boxes.length; i++) {
            var box = {};
            box.x1 = current_boxes[i].x1;
            box.y1 = current_boxes[i].y1;
            box.x2 = current_boxes[i].x2;
            box.y2 = current_boxes[i].y2;
            box.x3 = current_boxes[i].x3;
            box.y3 = current_boxes[i].y3;
            box.x4 = current_boxes[i].x4;
            box.y4 = current_boxes[i].y4;
            box.label = '';
            data.boxes.push(box);
        }

        var json = JSON.stringify(data);
        Http.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        Http.send(json);
        Http.onload=(e)=>{
            console.log("UploadAnnotations done!");
        }

    }
        
    function main() {
        return __awaiter(this, void 0, void 0, function* () {
            yield ImGui.default();
            if (typeof (window) !== "undefined") {
                window.requestAnimationFrame(_init);
            }
            else {
                function _main() {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield _init();
                        for (let i = 0; i < 3; ++i) {
                            _loop(1 / 60);
                        }
                        yield _done();
                    });
                }
                _main().catch(console.error);
            }
        });
    }
    exports_1("default", main);
    function AddFontFromFileTTF(url, size_pixels, font_cfg = null, glyph_ranges = null) {
        return __awaiter(this, void 0, void 0, function* () {
            font_cfg = font_cfg || new ImGui.ImFontConfig();
            font_cfg.Name = font_cfg.Name || `${url.split(/[\\\/]/).pop()}, ${size_pixels.toFixed(0)}px`;
            return ImGui.GetIO().Fonts.AddFontFromMemoryTTF(yield LoadArrayBuffer(url), size_pixels, font_cfg, glyph_ranges);
        });
    }
    function _init() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Total allocated space (uordblks) @ _init:", ImGui.bind.mallinfo().uordblks);
            // Setup Dear ImGui binding
            ImGui.IMGUI_CHECKVERSION();
            ImGui.CreateContext();
            const io = ImGui.GetIO();
            // io.ConfigFlags |= ImGui.ConfigFlags.NavEnableKeyboard;  // Enable Keyboard Controls
            // Setup style
            ImGui.StyleColorsDark();
            //ImGui.StyleColorsClassic();
            // Load Fonts
            // - If no fonts are loaded, dear imgui will use the default font. You can also load multiple fonts and use ImGui::PushFont()/PopFont() to select them.
            // - AddFontFromFileTTF() will return the ImFont* so you can store it if you need to select the font among multiple.
            // - If the file cannot be loaded, the function will return NULL. Please handle those errors in your application (e.g. use an assertion, or display an error and quit).
            // - The fonts will be rasterized at a given size (w/ oversampling) and stored into a texture when calling ImFontAtlas::Build()/GetTexDataAsXXXX(), which ImGui_ImplXXXX_NewFrame below will call.
            // - Read 'misc/fonts/README.txt' for more instructions and details.
            // - Remember that in C/C++ if you want to include a backslash \ in a string literal you need to write a double backslash \\ !
            io.Fonts.AddFontDefault();
            font = yield AddFontFromFileTTF("../imgui/misc/fonts/Roboto-Medium.ttf", 16.0);
            // font = await AddFontFromFileTTF("../imgui/misc/fonts/Cousine-Regular.ttf", 15.0);
            // font = await AddFontFromFileTTF("../imgui/misc/fonts/DroidSans.ttf", 16.0);
            // font = await AddFontFromFileTTF("../imgui/misc/fonts/ProggyTiny.ttf", 10.0);
            // font = await AddFontFromFileTTF("c:\\Windows\\Fonts\\ArialUni.ttf", 18.0, null, io.Fonts.GetGlyphRangesJapanese());
            // font = await AddFontFromFileTTF("https://raw.githubusercontent.com/googlei18n/noto-cjk/master/NotoSansJP-Regular.otf", 18.0, null, io.Fonts.GetGlyphRangesJapanese());
            ImGui.IM_ASSERT(font !== null);
            if (typeof (window) !== "undefined") {
                const output = document.getElementById("output") || document.body;
                const canvas = document.createElement("canvas");
                output.appendChild(canvas);
                canvas.tabIndex = 1;
                canvas.style.position = "absolute";
                canvas.style.left = "0px";
                canvas.style.right = "0px";
                canvas.style.top = "0px";
                canvas.style.bottom = "0px";
                canvas.style.width = "100%";
                canvas.style.height = "100%";
                ImGui_Impl.Init(canvas);                
            }
            else {
                ImGui_Impl.Init(null);
            }
            StartUpImage();
            StartUpVideo();
            if (typeof (window) !== "undefined") {
                window.requestAnimationFrame(_loop);
            }
            LoadDatasets();
        });
    }

    function STATIC(key, value) {
        return _static[key] || (_static[key] = new Static(value));
    }

    // Main loop
    function _loop(time) {
        // Poll and handle events (inputs, window resize, etc.)
        // You can read the io.WantCaptureMouse, io.WantCaptureKeyboard flags to tell if dear imgui wants to use your inputs.
        // - When io.WantCaptureMouse is true, do not dispatch mouse input data to your main application.
        // - When io.WantCaptureKeyboard is true, do not dispatch keyboard input data to your main application.
        // Generally you may always pass all inputs to dear imgui, and hide them from your application based on those two flags.
        // Start the Dear ImGui frame
        ImGui_Impl.NewFrame(time);
        ImGui.NewFrame();

        {
            ImGui.Begin("Annotator Supreme"); 
            ImGui.Text("This is just a proof of concept... so it will be buggy");
            ImGui.Text(`Application average ${(1000.0 / ImGui.GetIO().Framerate).toFixed(3)} ms/frame (${ImGui.GetIO().Framerate.toFixed(1)} FPS)`);

            if (ImGui.ImageButton(hal_image.gl_texture, new imgui_js_1.ImVec2(100, 100))) {
                if (hal_image.image) {
                    hal_image.image.src = 'https://static01.nyt.com/images/2018/05/15/arts/01hal-voice1/merlin_135847308_098289a6-90ee-461b-88e2-20920469f96a-articleLarge.jpg';
                }
            }

            if (ImGui.IsItemHovered()) {
                ImGui.BeginTooltip();
                ImGui.Text(image_url);
                ImGui.EndTooltip();
            }

            ImGui.Checkbox("Annotation Window", (value = annotating_active) => annotating_active = value); // Edit bools storing our windows open/close state

            if(ImGui.CollapsingHeader("Datasets")) {
                for (var i=0; i<all_datasets.length; i++) {
                    if (ImGui.Selectable(all_datasets[i]['name']+"##"+i.toString(), current_dataset == i)) {
                        current_dataset = i;
                        LoadImages();
                    }
                }

                if (all_datasets.length > 0) {
                    if (ImGui.Button("Delete")) {
                        deleting_dataset = true;
                    }
                }
                if (deleting_dataset) {
                    ImGui.Text("Are you sure you wan't to remove this dataset?");
                    if (ImGui.Button("Yes##delete")) {
                        const Http = new XMLHttpRequest();
                        var id = all_datasets[current_dataset]["id"].toString();
                        const url = 'http://192.168.1.42:8094/annotator_supreme/dataset/'+id;
                        Http.open("DELETE", url, true);
                        Http.send();
                        Http.onload=(e)=>{
                            LoadDatasets();
                        }

                        deleting_dataset = false;
                    }
                    if (ImGui.Button("No##delete")) {
                        deleting_dataset = false;
                    }
                }
                
                ImGui.InputText("##input_dataset", (value = dataset_name) => dataset_name = value); 
                ImGui.SameLine();
                if (ImGui.Button("Add Dataset") && dataset_name) {
                    const Http = new XMLHttpRequest();
                    const url='http://192.168.1.42:8094/annotator_supreme/dataset';
                    Http.open("POST", url, true);
                    
                    var data = {}
                    data.name = dataset_name;
                    var json = JSON.stringify(data);
                    Http.setRequestHeader("Content-Type", "application/json; charset=utf-8");
                    Http.send(json);
                    Http.onload=(e)=>{
                        LoadDatasets();
                    }
                    dataset_name = '';
                }
            }
            
            const io = ImGui.GetIO();
            ImGui.Text("Mouse clicked:");
            for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.MouseDown); i++)
                if (ImGui.IsMouseClicked(i)) {
                    ImGui.SameLine();
                    ImGui.Text(`b${i}`);
                }
            ImGui.Text("Mouse dbl-clicked:");
            for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.MouseDown); i++)
                if (ImGui.IsMouseDoubleClicked(i)) {
                    ImGui.SameLine();
                    ImGui.Text(`b${i}`);
                }
            ImGui.Text("Mouse released:");
            for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.MouseDown); i++)
                if (ImGui.IsMouseReleased(i)) {
                    ImGui.SameLine();
                    ImGui.Text(`b${i}`);
                }

            ImGui.Text("Keys down:");
            for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.KeysDown); i++)
                if (io.KeysDownDuration[i] >= 0.0) {
                    ImGui.SameLine();
                    ImGui.Text(`${i} (${io.KeysDownDuration[i].toFixed(2)} secs)`);
                }
            ImGui.Text("Keys pressed:");
            for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.KeysDown); i++)
                if (ImGui.IsKeyPressed(i)) {
                    ImGui.SameLine();
                    ImGui.Text(i.toString());
                }
            ImGui.Text("Keys release:");
            for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.KeysDown); i++)
                if (ImGui.IsKeyReleased(i)) {
                    ImGui.SameLine();
                    ImGui.Text(i.toString());
                }

            for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.KeysDown); i++) {
                if (ImGui.IsKeyPressed(i) && i==37) {
                    UploadAnnotations();
                    current_image -= 1;
                    if (current_image < 0) 
                        current_image = 0;
                    LoadCurrentImage();
                } else if (ImGui.IsKeyPressed(i) && i==39) {
                    UploadAnnotations();
                    current_image += 1;
                    if (current_image >= all_images.length)
                        current_image = all_images.length-1;
                    LoadCurrentImage();
                }
            }


            
            if (ImGui.Button("Upload Images")) {
                upload_images = !upload_images;
            }
            if (upload_images) {
                const gl = ImGui_Impl.gl;
                gl.canvas.style.left = "100px";
                document.getElementById('picField').onchange = function (evt) {
                    var tgt = evt.target || window.event.srcElement,
                        files = tgt.files;

                    if (files && files.length) {
                        var id = all_datasets[current_dataset]["id"].toString();
                        UploadImages(id, files, 0);
                    }

                    upload_images = false;
                    gl.canvas.style.left = "0px";
                }
            } else {
                const gl = ImGui_Impl.gl;
                gl.canvas.style.left = "0px";
            }

            if (font) {
                ImGui.PushFont(font);
                ImGui.Text(`${font.GetDebugName()}`);
                if (font.FindGlyphNoFallback(0x5929)) {
                    ImGui.Text(`U+5929: \u5929`);
                }
                ImGui.PopFont();
            }
            ImGui.End();
        }
        if (annotating_active) {
            ImGui.Begin("Annotate Image"); 
            var num_images = 0;
            var image_id = " ";
            if (all_images) {
                num_images = all_images.length;
                image_id = all_images[current_image]["id"].toString();
            }
            
            ImGui.Text("Current Image: "+current_image.toString()+"/"+num_images.toString()+" - ID "+image_id);
            
            const annotation_mode = STATIC("annotation_mode", 1);

            var bbox_active      = (annotation_mode.value==0);
            var landmarks_active = (annotation_mode.value==1);
            var ocrs_active      = (annotation_mode.value==2);
            if (ImGui.Checkbox("Bounding Box", (value = bbox_active) => bbox_active = value))
                annotation_mode.value = 0;
            ImGui.SameLine();
            if (ImGui.Checkbox("Landmarks", (value = landmarks_active) => landmarks_active = value))
                annotation_mode.value = 1;
            ImGui.SameLine();
            if (ImGui.Checkbox("OCRs", (value = ocrs_active) => ocrs_active = value))
                annotation_mode.value = 2;

            if (landmarks_active) {
                var num_landmarks_str = num_landmarks.toString();
                ImGui.PushItemWidth(30);
                ImGui.InputText("##input_landmarks_num", (value = num_landmarks_str) => num_landmarks_str = value);
                ImGui.SameLine();
                ImGui.Text("Landmarks Number");
                num_landmarks = parseInt(num_landmarks_str);

                ImGui.SameLine();
                if (ImGui.Button("Delete Landmarks")) {
                    current_landmarks = []
                    current_landmark_idx = 0;
                    frame_updated = true;
                }
            }


            ImGui.Checkbox("Scale Image to Window", (value = scale_image_to_window) => scale_image_to_window = value);
            const image_scale = STATIC("image_scale", 0.75);
            ImGui.PushItemWidth(200);
            if (ImGui.SliderFloat("##Image Scale", (value = image_scale.value) => image_scale.value = value, 0.1, 4.0, "Image Scale = %.3f")) {
                scale_image_to_window = false;
            }

            if (current_texture_image && current_texture_image.gl_texture) {
                var im_cols = current_texture_image.width;
                var im_rows = current_texture_image.height;

                var scale = image_scale.value;
                if (scale_image_to_window) {
                    scale =  ImGui.GetContentRegionAvailWidth() / current_texture_image.width;
                    if (scale > ImGui.GetContentRegionAvail().y / current_texture_image.height)
                        scale = ImGui.GetContentRegionAvail().y / current_texture_image.height;

                    if (scale*current_texture_image.width < 10) scale = 1;
                }
                var plot_width = Math.round(current_texture_image.width*scale);
                var plot_height = Math.round(current_texture_image.height*scale);
                var screen_pos = ImGui.GetCursorScreenPos();
                // This invisible button prevents that we move the whole screen
                // when clicking and dragging on the image.
                ImGui.InvisibleButton("Annotation Button", new imgui_js_1.ImVec2(plot_width, plot_height));
                ImGui.SetCursorScreenPos(screen_pos);


                const io = ImGui.GetIO();
                if (landmarks_active) {
                    if (ImGui.IsMouseDragging()) {
                        console.log("Mouse is dragging");
                        if (drag_status.dragging == false) {
                            drag_status.dragging = true;
                            drag_status.dx = drag_status.dy = 0;
                                
                            var closest_landmark =  GetClosestLandmark(
                                            (io.MousePos.x-screen_pos.x)/scale, 
                                            (io.MousePos.y-screen_pos.y)/scale, 30/scale);
                            
                            drag_status.landmark_idx = closest_landmark[0];
                            drag_status.landmark_pt_idx = closest_landmark[1];
                        }
                        
                        var x = (io.MousePos.x-screen_pos.x)/scale;
                        var y = (io.MousePos.y-screen_pos.y)/scale;
                        if( UpdateDraggingAnno(drag_status, x, y) )
                            frame_updated = true;
                    } 
                    else { 
                        if (drag_status.dragging) { // I'm stoping the dragging
                            frame_updated = true;
                            drag_status.landmark_idx = -1;
                            drag_status.landmark_pt_idx = -1;
                            drag_status.dragging = false;
                        } 
                        else { // normal case, there was no dragging on previous frame
                            if (current_landmarks.length == 0)
                                current_landmarks.push([]);
                            
                            if (current_landmarks[current_landmark_idx].length < num_landmarks) {
                                for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.MouseDown); i++) {
                                    if (ImGui.IsMouseReleased(i)) {
                                        if ( (io.MousePos.x-screen_pos.x) >= 0 &&
                                             (io.MousePos.y-screen_pos.y) >= 0 && 
                                             (io.MousePos.x-screen_pos.x)/scale <= im_cols &&
                                             (io.MousePos.y-screen_pos.y)/scale <= im_rows) 
                                        {
                                            current_landmarks[current_landmark_idx].push(new Landmark(
                                                    (io.MousePos.x-screen_pos.x)/scale,
                                                    (io.MousePos.y-screen_pos.y)/scale));
                                            frame_updated = true;
                                            if (current_landmarks[current_landmark_idx].length == num_landmarks) {
                                                current_landmark_idx += 1;
                                                current_landmarks.push([]);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else if (bbox_active) {
                    // if (ImGui.IsMouseDragging()) {
                    //     console.log("Mouse is dragging");
                    //     if (drag_status.dragging == false) {
                    //         drag_status.dragging = true;
                    //         drag_status.dx = drag_status.dy = 0;
                    //             
                    //         var closest_box =  GetClosestBox(
                    //                         (io.MousePos.x-screen_pos.x)/scale, 
                    //                         (io.MousePos.y-screen_pos.y)/scale, 30);
                    //         
                    //         drag_status.box_idx = closest_box[0];
                    //         drag_status.box_pt_idx = closest_box[1];
                    //     }
                    //     
                    //     var x = (io.MousePos.x-screen_pos.x)/scale;
                    //     var y = (io.MousePos.y-screen_pos.y)/scale;
                    //     if( UpdateDraggingBox(drag_status, x, y) )
                    //         frame_updated = true;
                    // } 
                    // else { 
                    //     if (drag_status.dragging) { // I'm stoping the dragging
                    //         frame_updated = true;
                    //         drag_status.box_idx = -1;
                    //         drag_status.box_pt_idx = -1;
                    //         drag_status.dragging = false;
                    //     } 
                    //     else { // normal case, there was no dragging on previous frame
                    //         if (current_boxes.length == 0)
                    //             current_boxes.push([]);
                    //         
                    //         if (current_boxes[current_box_idx].length < 4) {
                    //             for (let i = 0; i < ImGui.IM_ARRAYSIZE(io.MouseDown); i++) {
                    //                 if (ImGui.IsMouseReleased(i)) {
                    //                     if ( (io.MousePos.x-screen_pos.x) >= 0 &&
                    //                          (io.MousePos.y-screen_pos.y) >= 0 && 
                    //                          (io.MousePos.x-screen_pos.x)/scale <= im_cols &&
                    //                          (io.MousePos.y-screen_pos.y)/scale <= im_rows) 
                    //                     {
                    //                         current_landmarks[current_landmark_idx].push(new Landmark(
                    //                                 (io.MousePos.x-screen_pos.x)/scale,
                    //                                 (io.MousePos.y-screen_pos.y)/scale));
                    //                         frame_updated = true;
                    //                         if (current_landmarks[current_landmark_idx].length == num_landmarks) {
                    //                             current_landmark_idx += 1;
                    //                             current_landmarks.push([]);
                    //                         }
                    //                     }
                    //                 }
                    //             }
                    //         }
                    //     }
                    // }

                    console.log("Code to anno bounding box");
                } else if(ocrs_active) {                   
                    console.log("Code to anno ocrs");
                    for (let i=0; i<current_ocrs.length; i++) {
                        if (current_texture_image.width < 10) {
                            continue;
                        }
                        if (current_ocrs[i].image == null) {
                            var box_idx = current_ocrs[i].box_idx;
                            current_ocrs[i].image = GetImageCrop(current_texture_image, current_boxes[box_idx]);
                        }
                        // ImGui.BeginChild("Namei", imgui_js_1.ImVec2(width,height), false)
                        ImGui.Image(current_ocrs[i].image, new imgui_js_1.ImVec2(200, 100));
                        // ImGui.EndChild();
                    }
                }

                if (screen_pos == screen_pos && frame_updated) {
                    const gl = ImGui_Impl.gl;

                    var pixels = GetOriginalPixels(current_texture_image);
                    for (let i=0; i<current_landmarks.length; i++) {
                        for (let j=0; j<current_landmarks[i].length; j++) {
                            DrawPoint(current_texture_image, pixels, current_landmarks[i][j].x, current_landmarks[i][j].y, plot_width, plot_height, 4, false);
                            var j2 = j+1;                            
                            if (j2 >= num_landmarks) 
                                j2 = 0;
                            if (j2 >= current_landmarks[i].length)
                                continue;
                            
                            DrawLine (current_landmarks[i][j].x, current_landmarks[i][j].y, 
                                    current_landmarks[i][j2].x, current_landmarks[i][j2].y,
                                    pixels, current_texture_image, 
                                    plot_width, plot_height, 4);
                        }
                    }

                    UpdateTexture(current_texture_image, pixels, gl);
                    // Did I updated the correct frame or the image is not loaded yet?
                    if (current_texture_image.width > 10)
                        frame_updated = false;
                }

                ImGui.Image(current_texture_image.gl_texture, new imgui_js_1.ImVec2(plot_width, plot_height));
            }
            ImGui.End();
        }



        ImGui.EndFrame();
        // Rendering
        ImGui.Render();
        const gl = ImGui_Impl.gl;
        if (gl) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.clearColor(clear_color.x, clear_color.y, clear_color.z, clear_color.w);
            gl.clear(gl.COLOR_BUFFER_BIT);
            //gl.useProgram(0); // You may want this if using this code in an OpenGL 3+ context where shaders may be bound
        }
        UpdateVideo();
        ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
        if (typeof (window) !== "undefined") {
            window.requestAnimationFrame(done ? _done : _loop);
        }
    }
    function _done() {
        return __awaiter(this, void 0, void 0, function* () {
            const gl = ImGui_Impl.gl;
            if (gl) {
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                gl.clearColor(clear_color.x, clear_color.y, clear_color.z, clear_color.w);
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
            CleanUpImage();
            CleanUpVideo();
            // Cleanup
            ImGui_Impl.Shutdown();
            ImGui.DestroyContext();
            console.log("Total allocated space (uordblks) @ _done:", ImGui.bind.mallinfo().uordblks);
        });
    }
    function ShowHelpMarker(desc) {
        ImGui.TextDisabled("(?)");
        if (ImGui.IsItemHovered()) {
            ImGui.BeginTooltip();
            ImGui.PushTextWrapPos(ImGui.GetFontSize() * 35.0);
            ImGui.TextUnformatted(desc);
            ImGui.PopTextWrapPos();
            ImGui.EndTooltip();
        }
    }
    function ShowSandboxWindow(title, p_open = null) {
        ImGui.SetNextWindowSize(new imgui_js_1.ImVec2(320, 240), ImGui.Cond.FirstUseEver);
        ImGui.Begin(title, p_open);
        ImGui.Text("Source");
        ImGui.SameLine();
        ShowHelpMarker("Contents evaluated and appended to the window.");
        ImGui.PushItemWidth(-1);
        ImGui.InputTextMultiline("##source", (_ = source) => (source = _), 1024, imgui_js_1.ImVec2.ZERO, ImGui.InputTextFlags.AllowTabInput);
        ImGui.PopItemWidth();
        try {
            eval(source);
        }
        catch (e) {
            ImGui.TextColored(new imgui_js_2.ImVec4(1.0, 0.0, 0.0, 1.0), "error: ");
            ImGui.SameLine();
            ImGui.Text(e.message);
        }
        ImGui.End();
    }
    function ShowGamepadWindow(title, p_open = null) {
        ImGui.Begin(title, p_open, ImGui.WindowFlags.AlwaysAutoResize);
        const gamepads = (typeof (navigator) !== "undefined" && typeof (navigator.getGamepads) === "function") ? navigator.getGamepads() : [];
        if (gamepads.length > 0) {
            for (let i = 0; i < gamepads.length; ++i) {
                const gamepad = gamepads[i];
                ImGui.Text(`gamepad ${i} ${gamepad && gamepad.id}`);
                if (!gamepad) {
                    continue;
                }
                ImGui.Text(`       `);
                for (let button = 0; button < gamepad.buttons.length; ++button) {
                    ImGui.SameLine();
                    ImGui.Text(`${button.toString(16)}`);
                }
                ImGui.Text(`buttons`);
                for (let button = 0; button < gamepad.buttons.length; ++button) {
                    ImGui.SameLine();
                    ImGui.Text(`${gamepad.buttons[button].value}`);
                }
                ImGui.Text(`axes`);
                for (let axis = 0; axis < gamepad.axes.length; ++axis) {
                    ImGui.Text(`${axis}: ${gamepad.axes[axis].toFixed(2)}`);
                }
            }
        }
        else {
            ImGui.Text("connect a gamepad");
        }
        ImGui.End();
    }
    function StartUpImage() {
        const gl = ImGui_Impl.gl;
        if (gl) {
            const width = 256;
            const height = 256;
            const pixels = new Uint8Array(4 * width * height);
            image_gl_texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, image_gl_texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            const image = image_element = new Image();
            image.crossOrigin = "anonymous";
            image.addEventListener("load", (event) => {
                gl.bindTexture(gl.TEXTURE_2D, image_gl_texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            });
            image.src = image_url;

            hal_image = new TextureImage("https://avatars1.githubusercontent.com/u/16866042", gl);//"https://static01.nyt.com/images/2018/05/15/arts/01hal-voice1/merlin_135847308_098289a6-90ee-461b-88e2-20920469f96a-articleLarge.jpg", gl);
        }
    }
    function CleanUpImage() {
        const gl = ImGui_Impl.gl;
        if (gl) {
            gl.deleteTexture(image_gl_texture);
            image_gl_texture = null;
            image_element = null;
        }
    }
    function StartUpVideo() {
        const gl = ImGui_Impl.gl;
        if (gl) {
            video_element = document.createElement("video");
            video_element.crossOrigin = "anonymous";
            video_element.src = video_url;
            video_element.load();
            const width = 256;
            const height = 256;
            const pixels = new Uint8Array(4 * width * height);
            video_gl_texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, video_gl_texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        }
    }
    function CleanUpVideo() {
        const gl = ImGui_Impl.gl;
        if (gl) {
            gl.deleteTexture(video_gl_texture);
            video_gl_texture = null;
            video_element = null;
        }
    }
    function UpdateVideo() {
        const gl = ImGui_Impl.gl;
        if (gl && video_element && video_element.readyState >= video_element.HAVE_CURRENT_DATA) {
            gl.bindTexture(gl.TEXTURE_2D, video_gl_texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video_element);
        }
    }
    function ShowMovieWindow(title, p_open = null) {
        ImGui.Begin(title, p_open, ImGui.WindowFlags.AlwaysAutoResize);
        if (video_element !== null) {
            if (p_open && !p_open()) {
                video_element.pause();
            }
            const w = video_element.videoWidth;
            const h = video_element.videoHeight;
            if (w > 0) {
                video_w = w;
            }
            if (h > 0) {
                video_h = h;
            }
            ImGui.BeginGroup();
            if (ImGui.BeginCombo("##urls", null, ImGui.ComboFlags.NoPreview | ImGui.ComboFlags.PopupAlignLeft)) {
                for (let n = 0; n < ImGui.IM_ARRAYSIZE(video_urls); n++) {
                    if (ImGui.Selectable(video_urls[n])) {
                        video_url = video_urls[n];
                        console.log(video_url);
                        video_element.src = video_url;
                        video_element.autoplay = true;
                    }
                }
                ImGui.EndCombo();
            }
            ImGui.SameLine();
            ImGui.PushItemWidth(video_w - 20);
            if (ImGui.InputText("##url", (value = video_url) => video_url = value)) {
                console.log(video_url);
                video_element.src = video_url;
            }
            ImGui.PopItemWidth();
            ImGui.EndGroup();
            if (ImGui.ImageButton(video_gl_texture, new imgui_js_1.ImVec2(video_w, video_h))) {
                if (video_element.readyState >= video_element.HAVE_CURRENT_DATA) {
                    video_element.paused ? video_element.play() : video_element.pause();
                }
            }
            ImGui.BeginGroup();
            if (ImGui.Button(video_element.paused ? "Play" : "Stop")) {
                if (video_element.readyState >= video_element.HAVE_CURRENT_DATA) {
                    video_element.paused ? video_element.play() : video_element.pause();
                }
            }
            ImGui.SameLine();
            if (!video_time_active) {
                video_time = video_element.currentTime;
                video_duration = video_element.duration || 0;
            }
            ImGui.SliderFloat("##time", (value = video_time) => video_time = value, 0, video_duration);
            const video_time_was_active = video_time_active;
            video_time_active = ImGui.IsItemActive();
            if (!video_time_active && video_time_was_active) {
                video_element.currentTime = video_time;
            }
            ImGui.EndGroup();
        }
        else {
            ImGui.Text("No Video Element");
        }
        ImGui.End();
    }
    return {
        setters: [
            function (ImGui_1) {
                ImGui = ImGui_1;
                imgui_js_1 = ImGui_1;
                imgui_js_2 = ImGui_1;
            },
            function (ImGui_Impl_1) {
                ImGui_Impl = ImGui_Impl_1;
            },
            function (imgui_demo_1_1) {
                imgui_demo_1 = imgui_demo_1_1;
            },
            function (imgui_memory_editor_1_1) {
                imgui_memory_editor_1 = imgui_memory_editor_1_1;
            }
        ],
        execute: function () {
            font = null;
            show_demo_window = true;
            show_another_window = false;
            clear_color = new imgui_js_2.ImVec4(0.45, 0.55, 0.60, 1.00);
            memory_editor = new imgui_memory_editor_1.MemoryEditor();
            show_sandbox_window = false;
            show_gamepad_window = false;
            show_movie_window = false;
            annotating_active = true;
            num_landmarks = 4;
            upload_images = false;
            current_dataset = 0;
            all_datasets = null;
            current_image = 0;
            current_landmark_idx = 0;
            current_boxes = [];
            current_boxes.push([]);
            current_landmarks = [];
            current_landmarks.push([]);
            all_images = null;
            dataset_name = '';
            deleting_dataset = false;
            frame_updated = true;
            drag_status = new DraggingStatus();
            image_scale = 0.75;
            scale_image_to_window = true;
            /* static */ f = 0.0;
            /* static */ counter = 0;
            Static = class Static {
                constructor(value) {
                    this.value = value;
                }
            };
            _static = {};

            done = false;
            source = [
                "ImGui.Text(\"Hello, world!\");",
                "ImGui.SliderFloat(\"float\",",
                "\t(value = f) => f = value,",
                "\t0.0, 1.0);",
                "",
            ].join("\n");
            image_urls = [
                "https://threejs.org/examples/textures/crate.gif",
                "https://threejs.org/examples/textures/sprite.png",
                "https://threejs.org/examples/textures/UV_Grid_Sm.jpg",
            ];
            image_url = image_urls[0];
            image_element = null;
            image_gl_texture = null;
            video_urls = [
                "https://threejs.org/examples/textures/sintel.ogv",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
            ];
            video_url = video_urls[0];
            video_element = null;
            video_gl_texture = null;
            video_w = 640;
            video_h = 360;
            video_time_active = false;
            video_time = 0;
            video_duration = 0;
        }
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0lBMkJBLFNBQWUsZUFBZSxDQUFDLEdBQVc7O1lBQ3RDLE1BQU0sUUFBUSxHQUFhLE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzVDLE9BQU8sUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2xDLENBQUM7S0FBQTtJQUVELFNBQThCLElBQUk7O1lBQzlCLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3RCLElBQUksT0FBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLFdBQVcsRUFBRTtnQkFDaEMsTUFBTSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ3ZDO2lCQUFNO2dCQUNILFNBQWUsS0FBSzs7d0JBQ2hCLE1BQU0sS0FBSyxFQUFFLENBQUM7d0JBQ2QsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTs0QkFBRSxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO3lCQUFFO3dCQUM5QyxNQUFNLEtBQUssRUFBRSxDQUFDO29CQUNsQixDQUFDO2lCQUFBO2dCQUNELEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDaEM7UUFDTCxDQUFDO0tBQUE7O0lBRUQsU0FBZSxrQkFBa0IsQ0FBQyxHQUFXLEVBQUUsV0FBbUIsRUFBRSxXQUFzQyxJQUFJLEVBQUUsZUFBOEIsSUFBSTs7WUFDOUksUUFBUSxHQUFHLFFBQVEsSUFBSSxJQUFJLEtBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNoRCxRQUFRLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFL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
