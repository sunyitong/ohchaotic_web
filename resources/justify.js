define([

],
function(

) {
	return Backbone.View.extend({

		name: 'Justify',
		rendered: false,
		parentView: null,

		// store thumb width info here
		meta_data: {},

		/**
		 * Set attributes to el for layout options.
		 *
		 * @return {Object} attributes
		 */
		attributes: function () {
			var model_data = this.model.get('data')

			var attributes = {
				'thumbnails': this.name.toLowerCase(),
				'grid-row'   : '',
				'thumbnails-pad'   : '',
				'thumbnails-gutter': '',
				'data-elementresizer': ''								
			};

			var padding = this.model.get('mobile_active') ? parseFloat(this.model.get('data').responsive_thumbnails_padding) : parseFloat(this.model.get('data').thumbnails_padding)
			if ( padding == 0){
				attributes['data-padding-zero'] = ''
			}

			return attributes;
		},

		/**
		 * Bind event listeners.
		 *
		 * @return {Object} this
		 */
		initialize: function (options) {
			if(options && options.parentView) {
				this.parentView = options.parentView;
			}

        	this.offset = 0;
        	this.row_index = 0;
        	this.row_indexes = [0];
        	this.page_offset = 0;  
			this.leftover_cache = []			

			this.paddingResizeCallback = _.throttle(this.paddingResize.bind(this), 10);
		    $(window).on("resize", this.paddingResizeCallback);

            this.listenTo(this.collection, 'sync', function(collection, response, options){

                if(options.from_pagination) {

                	// filter out duplicates from pages before rendering
					var collection = this.collection.toJSON()
					var pages = _.filter(response, function(page, index){

						if ( collection[index] ){
							if ( page.id !== collection[index].id) {
								return true
							} else {
							}
						}

					});

					if ( this.leftover_cache.length > 0){

						pages = this.leftover_cache.concat(pages)

						this.leftover_cache = []
					};				

					if ( pages.length == 0){
						return;
					}		

                    this.render(pages, false);

                } else {
					this.leftover_cache = []
					this.row_indexes = [0];
					this.row_index = 0;
					this.page_offset = 0;
                    this.render(null, true);
                }

            });		    

			// Test cross domain
			// this.windowResize = _.debounce(this.paddingResize.bind(this), 60)
			try {
				parent.document;

				// Listen to the Format Change sliders
				if (parent.hasOwnProperty('Cargo')) {
					if (parent.Cargo.hasOwnProperty('Event')) {
						parent.Cargo.Event.on('applied-presets', this.paddingResizeCallback );
					}
				}

			} catch(e){
				// not accessible
			}



			// this.collection = page collection. Render on change
			// this.listenTo(this.collection, 'update', this.render);
			// this.listenTo(this.collection, 'sync', this.render);

			this.listenTo(Cargo.Event, 'BaseUnit:set', this.paddingResizeCallback);

			this.listenTo(Cargo.Event, 'thumbnails_show', this.paddingResize);
			
			// this.model = thumbnail settings. Render on change to dynamically update
			this.listenTo(this.model, 'change', this.handleUpdates);

			this.listenTo(this.collection, 'change', this.collectionChange);	
			this.registerHandlebarHelpers();

			// Listener for when this view begins editing after it is first rendered
			// for a static way to check if we are editing use:
			// this.parentView.isEditing()
			this.listenTo(this.parentView, 'is_editing', function(isEditing) {
				// Do your thing
			});

			return this;
		},

		hideThumbs: function(){
			this.hidden = true;
			this.el.style.display = "none"
		},

		showThumbs: function(){
			this.hidden = false;			
			this.el.style.display = "";
			this.paddingResize();
		},
		
		remove: function(){
			this.stopListening();
		    $(window).off("resize",this.paddingResizeCallback)	

			try {
				parent.document;

				// Listen to the Format Change sliders
				if (parent.hasOwnProperty('Cargo')) {
					if (parent.Cargo.hasOwnProperty('Event')) {
						parent.Cargo.Event.off('applied-presets', this.paddingResizeCallback );
					}
				}
			} catch(e){
				// not accessible
			}

			Backbone.View.prototype.remove.apply(this, arguments);
		},

		/**
		 * Fired when a collection has changed
		 * Check to see if there is thumb_meta data in the 
		 * attributes and if so, re-render
		 * @param  {Object} model The model that has changed
		 */
		collectionChange: function(model) {
			var allow_change = ['thumb_meta', 'title', 'tags'];
			var has_change = _.findKey(model.changedAttributes(), function(value, key, object){ return (_.indexOf(allow_change, key) >= 0); });
			
			// There was a change to the thumb data, run an update
			if(has_change !== undefined) {
				this.render();
			}
		},			

		/**
		 * Handle the changes to the model triggered from the admin panel
		 * @param  {Object} event
		 * @param  {Object} options sent from settings model, changing and value
		 */		
		handleUpdates: function(event, options){

			if ( !options){
				return
			}

			if ( this.hidden ){
				return
			}


			var model_data = this.model.get('data')

			switch (options.changing) {
				case 'thumbnails_padding':
				case 'responsive_thumbnails_padding':
					this.paddingResize()
				    break;

				case 'mobile_active':
					if ( model_data.responsive ){
						this.updateThumbSize();	
					}
					break;

				case 'responsive':
					if ( this.model.get('mobile_active')){
						this.updateThumbSize();	
					}
    				break;

				case 'thumbnail_mode':
					break;

				case 'metadata':
					break;

				case 'variation_index':
					this.updateThumbSize();	
					break;					

				case 'row_height':
				case 'responsive_row_height':
					this.updateThumbSize();
					break;

				case 'crop':
					this.row_indexes = [0];
					this.row_index =0;
					this.page_offset = 0;

					this.render(null, true);
					break;

				case 'thumb_crop':
					this.render(null, true);
					break;					

				case 'show_tags':
					this.render(null, true);
					break;		

				case 'show_thumbs':
					if ( model_data.show_thumbs ){
						this.render(null, true);						
					}
					break;

				case 'show_title':
					this.render(null, true);
					break;	

				case 'show_excerpt':
					this.render(null, true);
					break;

				default:
				    break;					

			}

		},

		calcRowHeights: function(use_offset){

			var _this = this;
			var model_data = _.clone(this.model.get('data'));

			if ( this.model.get('mobile_active') && model_data.responsive){
				model_data = _.extend(model_data, model_data.mobile_data);
			} 

			pages = this.collection.toJSON();

			// calculate row widths
			var row_data = {};
			var row_width = 0;
			var row_indexes = use_offset ? this.row_indexes || [0] : [0];
			var row_index = use_offset ? this.row_index || 0 : 0;
			var new_row = true;
			var target_width = 100;
			var variation_seed = model_data.variation_seed || 0;
			var page_offset = use_offset ? this.page_offset || 0 : 0;

			var page_offset_subtraction = 0;


			var crop_keys = {
				'1x1': {
					w: 1,
					h: 1
				},
				'4x3': {
					w: 4,
					h: 3
				},
				'16x9': {
					w: 16,
					h: 9
				}
			}

			for (var index = page_offset; index < pages.length; index++){

				var page = pages[index];

				var target_height = model_data.row_height*.8 + 6;

				if ( new_row ){

					// variation itself is used as a 'seed' to prevent first row from always being the same
					switch (model_data.variation_mode) {

						// try to match uniform height
						case 0:
							target_width = 100;
						    break;

						// use 0 +1 0 -1 pattern
						case 1:
							target_width = Math.cos(Math.PI*.5*(row_index+variation_seed)) * model_data.variation + 100
							break;

						// use -1 +1 pattern
						case 2:
							target_width = Math.cos(Math.PI*(row_index+variation_seed)) * model_data.variation*(model_data.row_height/100) + 100
							break;

						case 3:
						// go completely random
							target_width = Math.cos(row_index+variation_seed*index) * model_data.variation + 100 + Math.abs(Math.sin(variation_seed)*100)
							break;	

						default:
							target_width = 100;
						    break;
					}

					// target_width = lerp(100,
						// Math.cos(Math.PI*.5*(row_index+1)) * (model_data.variation) + 100,
					// 	model_data.variation / 100);						

					// target_width = row_index%2 == 0 ? model_data.variation *.33 : model_data.variation;
					new_row = false;
				}

				var scaled_width;

				if ( model_data.crop){
					scaled_width = (target_height / crop_keys[model_data.thumb_crop].h ) * crop_keys[model_data.thumb_crop].w 
				} else if ( _.has(page, 'thumb_meta') && page.thumb_meta && page.thumb_meta.thumbnail_crop ){
					scaled_width = (target_height/page.thumb_meta.thumbnail_crop.imageModel.height) * page.thumb_meta.thumbnail_crop.imageModel.width
				} else {
					scaled_width = target_height;
				}

				row_width+= scaled_width;

				// if ending a row, we tally up the widths make it fill a line
				if ( row_width > target_width || index == pages.length + -1 ){

					var last_row_of_page = false;
					var last_row_of_collection = false;
					var calculate_row = true
					page_offset_subtraction = 0;

					if ( index == pages.length + -1 ){

						last_row_of_page = true;

						if ( this.collection.paginationComplete ){
							last_row_of_collection = true;
						}						

					}

					var occupied_width = row_width;

					// reset row_width
					row_width = 0;	

					// mark completed row
					row_index++;

					// mark start of next line with index + 1
					row_indexes.push(index+1)

					var thumbs_in_row = row_indexes[row_index] - row_indexes[row_index-1]

					var remaining_percent = ((target_width - occupied_width) / target_width)

					// if the thumbnails would be enlarged by a lot, we cache them
					if (remaining_percent > 0 && last_row_of_page && !last_row_of_collection && use_offset){

						for (var i = row_indexes[row_index-1]; i < row_indexes[row_index]; i++ ){

							page_offset_subtraction++;
							this.leftover_cache.push(pages[i]);

						}

						calculate_row = false

						row_index--;
						row_indexes.pop()

					} else if ( remaining_percent > .3 && last_row_of_collection && last_row_of_page ){

						remaining_percent = .05 / thumbs_in_row;

					}
	
					if ( calculate_row ){

						for (var i = row_indexes[row_index-1]; i < row_indexes[row_index]; i++ ){

							var index_offset = i;
							var new_scaled_width;

							if ( model_data.crop ){
								new_scaled_width = (target_height / crop_keys[model_data.thumb_crop].h ) * crop_keys[model_data.thumb_crop].w 							
							} else if ( _.has(pages[index_offset], 'thumb_meta') && pages[index_offset].thumb_meta && pages[index_offset].thumb_meta.thumbnail_crop ){
								new_scaled_width = (target_height/pages[index_offset].thumb_meta.thumbnail_crop.imageModel.height) * pages[index_offset].thumb_meta.thumbnail_crop.imageModel.width
							} else {
								new_scaled_width = target_height;
							}

							var percent = (new_scaled_width / target_width )* 100;
							var scale_up_percent = ((new_scaled_width / occupied_width) * remaining_percent) *100

							percent = Math.floor( (percent + scale_up_percent)*10000000 )/10000000;
							var mid = pages[index_offset].thumb_meta && pages[index_offset].thumb_meta.thumbnail_crop ? pages[index_offset].thumb_meta.thumbnail_crop.imageModel.id : pages[index_offset].id;

							this.meta_data[mid] = {
								width: percent,
								row: row_index
							}
							
							row_data[i] = percent;

						}

						row_width = 0;
						new_row = true;						
					}


				} else {

					row_data[index] = 0;

				}

			}

			if ( use_offset ){
				this.row_indexes = row_indexes;
				this.row_index = row_index;
				this.page_offset = index - page_offset_subtraction;
			}

		},

		leftover_cache: [],
		

		/**
		 * @return {Object} this
		 */
		render: function (response, render_all) {

			var _this = this;

			var data = Cargo.API.GetDataPackage('Pages', this.collection.toJSON());
			var pageCollection;


			this.calcRowHeights(true);				


			if ( !response ){
				pageCollection = data.Pages;
			} else {
				pageCollection = response;
			}

			// look for duplicates in page collection and leftover cache
			if ( this.leftover_cache.length > 0){

				for( var i = 0; i < this.leftover_cache.length; i++){

					for ( var j = pageCollection.length-1; j >=0; j-- ){
						if ( this.leftover_cache[i].id == pageCollection[j].id ){
							pageCollection.splice(j,1)
							
						}
					}

				}

			}

			// if there are no pages, we do not render
			if ( pageCollection.length == 0 ){
				return
			}


			data.Pages = pageCollection;

			var model_data = _.clone(this.model.get('data'));

			if ( this.model.get('mobile_active') && model_data.responsive){
				model_data = _.extend(model_data, model_data.mobile_data);
			} 

			var template = Cargo.Template.Get(this.model.get('name'), this.model.getTemplatePath());
			model_data.meta_data = _.clone(this.meta_data)
			data = _.extend(data, { 'settings' : model_data });
			var markup = Cargo.Core.Handlebars.Render(template, data);

			if ( render_all || !response ){
				this.$el.html(markup);				
			} else {
				this.$el.append(markup);
			}

			Cargo.Plugins.elementResizer.refresh()			

			this.fillInDefaults();
			this.rendered = true;
			
			this.paddingResize();

			Cargo.Event.trigger('thumbnails_render_complete');

			return this;

		},

		updateThumbSize: function(){

			if ( !this.rendered ){
				return
			}

			this.calcRowHeights()

			// if we've already rendered everything, we update layout instead of rerendering
			var thumbs = this.el.querySelectorAll('.thumbnail')

			for ( var j = 0; j < thumbs.length; j++){

				var thumb = thumbs[j];
				var mid = thumb.querySelector('.thumb_image img, .thumb_image svg').getAttribute('data-mid') || thumb.getAttribute('data-id')

				if ( mid ){
					thumb.style.width = this.meta_data[mid].width + "%";
					thumb.dataset.width = this.meta_data[mid].width;
					thumb.dataset.row = this.meta_data[mid].row		
				}
		
			}

			this.paddingResize();

			this.updateElementResizer()
		},

		updateElementResizer: _.debounce(function(){
			Cargo.Plugins.elementResizer.update()							
		}, 200),
		/**
		 * This will register any handlebar helpers we need
		 */
		registerHandlebarHelpers : function() {
			/**
			 * Helper to get the width for a single thumbnail
			 * based on image id
			 * @param  {Int} id Image id
			 */
			Handlebars.registerHelper ('getJustifyWidth', function (id, settings) {

				var item = settings.meta_data[id];
				return (item) ? item.width : "20";
			});

			Handlebars.registerHelper ('getJustifyRow', function (id, settings) {
				var item = settings.meta_data[id]
				return (item) ? item.row : "null";
			});
		},

		fillInDefaults: function(){
			// fill in incomplete data
			var default_thumbs = []
			var _this = this;
			this.collection.each(function(page, index){
				// use pid for mid if mid is not available
				if ( !page.get('thumb_meta') ){

					var id = page.get('id');
					var thumb = _this.el.querySelector('[data-id="'+id+'"]');

					if( _this.meta_data[id]  && thumb){

						thumb.style.width = _this.meta_data[id].width + "%";
						thumb.dataset.width = _this.meta_data[id].width;
						thumb.dataset.row = _this.meta_data[id].row						

					}

				}

			});

		},

		paddingResize: function(){

			var padding = this.model.get('mobile_active') ? parseFloat(this.model.get('data').responsive_thumbnails_padding) : parseFloat(this.model.get('data').thumbnails_padding)

			if ( padding == 0){

				this.el.dataset.paddingZero =''

			} else {

				this.el.removeAttribute('data-padding-zero')

			}

			if ( !this.rendered ){
				return;
			}

			var thumbs = this.el.querySelectorAll('.thumbnail');

			if ( thumbs.length == 0){
				return
			}

			if ( padding == 0){

				for ( var i = 0; i < thumbs.length; i++){

					thumbs[i].style.width = thumbs[i].dataset.width + "%"

				}					

			} else {

				var measure_div_container = document.createElement('DIV');

				measure_div_container.style.cssText = 'position: fixed; top: -999px; left: -9999px; width: 0;'

				if (this.model.get('data').responsive && this.model.get('mobile_active')){
					measure_div_container.setAttribute('responsive-layout','')
				}
				for (var j = 0; j < 10; j++){
					var measure_div = document.createElement('DIV')
					measure_div.setAttribute('thumbnails-pad', '')
					measure_div_container.appendChild(measure_div)
				}
				this.el.appendChild(measure_div_container)
				var pad_width = measure_div_container.offsetHeight / 10;
				this.el.removeChild(measure_div_container)

				var el_style = window.getComputedStyle(this.el);
				var el_width = parseFloat(el_style.width) - (parseFloat(el_style.paddingLeft)+parseFloat(el_style.paddingRight))
				var pad_percent = pad_width/el_width;
				var last_row = parseInt(thumbs[thumbs.length-1].dataset.row);

				for ( var i = 1; i <= last_row; i++){
					var thumb_row = this.el.querySelectorAll('[data-row="'+i+'"]')
					var percent_reduction = (el_width - (pad_percent*thumb_row.length)*el_width)/el_width + -.001;

					for (var j = 0; j<thumb_row.length; j++){
						var base_width = parseFloat(thumb_row[j].dataset.width);
						var new_width = Math.max(base_width * percent_reduction, 0);
						thumb_row[j].style.width = new_width + "%"
					}
					
				}	
							
			}


		},
		
	})
	

});
