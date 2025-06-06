define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		hideAdd = false,
		miscSettings = {};

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'menuDefineActions',
			'callflows.menu.edit': '_menuEdit',
			'callflows.menu.submoduleButtons': 'menuSubmoduleButtons'
		},

		// Added for the subscribed event to avoid refactoring menuEdit
		_menuEdit: function(args) {
			var self = this;
			self.menuEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		menuEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#menu-content'),
				target = _target || $('#menu-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success,
					save_error: _callbacks.save_error,
					delete_success: _callbacks.delete_success,
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						timeout: '10',
						interdigit_timeout: '2',
						max_extension_length: '4',
						media: {},
						extra: {
							retries: 2
						}
					}, data_defaults || {}),
					field_data: {
						media: []
					}
				};

			if (miscSettings.callflowButtonsWithinHeader) {
				self.menuSubmoduleButtons(data);
			};

			monster.parallel({
				media_list: function(callback) {

					var mediaFilters = {
						paginate: false
					};
		
					if (miscSettings.enableCustomCallflowActions && miscSettings.hideMailboxMedia) {
						mediaFilters['filter_not_media_source'] = 'recording';
					}

					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId,
							filters: mediaFilters
						},
						success: function(mediaList, status) {
							_.each(mediaList.data, function(media) {
								if (media.media_source) {
									media.name = '[' + media.media_source.substring(0, 3).toUpperCase() + '] ' + media.name;
								}
							});

							// sort data alphabetically
							mediaList.data = _.sortBy(mediaList.data, 'name');

							mediaList.data.unshift({
								id: '',
								name: self.i18n.active().callflows.menu.not_set
							});

							defaults.field_data.media = mediaList.data;

							callback(null, mediaList);
						}
					});
					
				},
				menu_get: function(callback) {
					if (typeof data === 'object' && data.id) {
						self.menuGet(data.id, function(menuData, status) {
							self.menuformatData(menuData);

							callback(null, { data: menuData });
						});
					} else {
						callback(null, {});
					}
				}
			}, function(err, results) {
				var render_data = defaults;

				if (typeof data === 'object' && data.id) {
					render_data = $.extend(true, defaults, results.menu_get);
				}

				self.menuRender(render_data, target, callbacks);

				if (typeof callbacks.after_render === 'function') {
					callbacks.after_render();
				}

				if (miscSettings.callflowButtonsWithinHeader) {
					miscSettings.popupEdit = false;
				}
				
			});
		},

		menuPopupEdit: function(data, callback, data_defaults) {
			var self = this,
				popup,
				popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>');

			if (miscSettings.callflowButtonsWithinHeader) {
				miscSettings.popupEdit = true;
			}

			self.menuEdit(data, popup_html, $('.inline_content', popup_html), {
				save_success: function(_data) {
					popup.dialog('close');

					if (typeof callback === 'function') {
						callback(_data);
					}
				},
				delete_success: function() {
					popup.dialog('close');

					if (typeof callback === 'function') {
						callback({ data: {} });
					}
				},
				after_render: function() {
					popup = monster.ui.dialog(popup_html, {
						title: (data.id) ? self.i18n.active().callflows.menu.edit_menu : self.i18n.active().callflows.menu.create_menu
					});
				}
			}, data_defaults);
		},

		menuRender: function(data, target, callbacks) {
			var self = this,
				menu_html = $(self.getTemplate({
					name: 'edit',
					data: {
						...data,
						hideAdd: hideAdd,
						miscSettings: miscSettings
					},
					submodule: 'menu'
				})),
				menuForm = menu_html.find('#menu-form');

			monster.ui.validate(menuForm, {
				rules: {
					'extra.retries': {
						digits: true,
						min: 0
					},
					'record_pin': {
						digits: true
					},
					'timeout': {
						number: true,
						max: 10
					},
					'interdigit_timeout': {
						number: true,
						max: 10
					},
					'max_extension_length': {
						digits: true
					}
				}
			});

			$('*[rel=popover]:not([type="text"])', menu_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', menu_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(menu_html);

			if (!$('#media_greeting', menu_html).val()) {
				$('#edit_link_media', menu_html).hide();
			}

			$('#media_greeting', menu_html).change(function() {
				!$('#media_greeting option:selected', menu_html).val() ? $('#edit_link_media', menu_html).hide() : $('#edit_link_media', menu_html).show();
			});

			$('.inline_action_media', menu_html).click(function(ev) {
				var _data = ($(this).data('action') === 'edit') ? { id: $('#media_greeting', menu_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();

				monster.pub('callflows.media.editPopup', {
					data: _data,
					callback: function(dataMedia) {
						/* Create */
						dataMedia.name = '[UPL] ' + dataMedia.name;

						if (!_id) {
							$('#media_greeting', menu_html).append('<option id="' + dataMedia.id + '" value="' + dataMedia.id + '">' + dataMedia.name + '</option>');
							$('#media_greeting', menu_html).val(dataMedia.id);

							$('#edit_link_media', menu_html).show();
						} else {
							/* Update */
							if (dataMedia.hasOwnProperty('id')) {
								$('#media_greeting #' + dataMedia.id, menu_html).text(dataMedia.name);
							/* Delete */
							} else {
								$('#media_greeting #' + _id, menu_html).remove();
								$('#edit_link_media', menu_html).hide();
							}
						}
					}
				});
			});

			// add search to dropdown
			menu_html.find('#media_greeting').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			$('.menu-save', menu_html).click(function(ev) {
				saveButtonEvents(ev);
			});

			$('#submodule-buttons-container .save').click(function(ev) {
				saveButtonEvents(ev);
			});

			function saveButtonEvents(ev) {
				ev.preventDefault();

				var $this = $(this);

				if (!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if (monster.ui.valid(menuForm)) {
						var form_data = monster.ui.getFormData('menu-form');

						self.menuCleanFormData(form_data);

						if ('field_data' in data) {
							delete data.field_data;
						}

						self.menuSave(form_data, data, callbacks.save_success, function() {
							$this.removeClass('disabled');
						});
					} else {
						$this.removeClass('disabled');
						monster.ui.alert('error', self.i18n.active().callflows.menu.there_were_errors_on_the_form);
					}
				}
			}

			$('.menu-delete', menu_html).click(function(ev) {
				deleteButtonEvents(ev);
			});

			$('#submodule-buttons-container .delete').click(function(ev) {
				deleteButtonEvents(ev);
			});

			function deleteButtonEvents(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.menu.are_you_sure_you_want_to_delete, function() {
					self.menuDelete(data.data.id, callbacks.delete_success, callbacks.delete_error);
				});

			};

			(target)
				.empty()
				.append(menu_html);
		},

		menuSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.menuNormalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data === 'object' && data.data.id) {
				self.menuUpdate(normalized_data, function(data, status) {
					success && success(data, status, 'update');
				}, error);
			} else {
				self.menuCreate(normalized_data, function(data, status) {
					success && success(data, status, 'create');
				}, error);
			}
		},

		menuformatData: function(data) {
			var self = this;

			data.extra = {};
			data.extra.retries = parseInt(data.retries) - 1;

			if (data.timeout) {
				data.timeout /= 1000; // ms to seconds
			}

			if (data.interdigit_timeout) {
				data.interdigit_timeout /= 1000; // ms to seconds
			}

			if (data.media) {
				if (data.media.invalid_media === false && data.media.transfer_media === false && data.media.exit_media === false) {
					data.suppress_media = true;
				} else {
					data.suppress_media = false;
				}
			}
		},

		menuCleanFormData: function(form_data) {
			if (form_data.max_extension_length < form_data.record_pin.length) {
				form_data.max_extension_length = form_data.record_pin.length;
			}

			/* Hack to put timeouts in ms in database. */
			form_data.timeout = form_data.timeout * 1000;
			form_data.interdigit_timeout = form_data.interdigit_timeout * 1000;

			form_data.retries = parseInt(form_data.extra.retries) + 1;

			if ('suppress_media' in form_data) {
				form_data.media = form_data.media || {};
				if (form_data.suppress_media === true) {
					form_data.media.invalid_media = false;
					form_data.media.transfer_media = false;
					form_data.media.exit_media = false;
				} else {
					form_data.media.invalid_media = true;
					form_data.media.transfer_media = true;
					form_data.media.exit_media = true;
				}
			}
		},

		menuNormalizeData: function(form_data) {
			if (!form_data.media.greeting) {
				delete form_data.media.greeting;
			}

			if (form_data.hunt_allow === '') {
				delete form_data.hunt_allow;
			}

			if (form_data.hunt_deny === '') {
				delete form_data.hunt_deny;
			}

			if (form_data.record_pin === '') {
				delete form_data.record_pin;
			}

			delete form_data.extra;

			return form_data;
		},

		menuDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			// set variables for use elsewhere
			hideAdd = args.hideAdd;
			miscSettings = args.miscSettings;

			$.extend(callflow_nodes, {
				'menu[id=*]': {
					name: self.i18n.active().callflows.menu.menu_title,
					icon: 'menu1',
					google_icon: 'dialpad',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'menu',
					tip: self.i18n.active().callflows.menu.menu_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '9999'
						}
					],
					isUsable: 'true',
					weight: 60,
					key_caption: function(child_node) {
						var key = child_node.key;

						return (key !== '_') ? key : self.i18n.active().callflows.menu.default_action;
					},
					key_edit: function(child_node, callback) {
						var popup, popup_html;

						/* The '#' Key is not available anymore but we let it here so that it doesn't break existing callflows.
						   The '#' Key is only displayed if it exists in the callflow, otherwise it is hidden by the template (see /tmpl/menu_key_callflow.html)
						*/

						popup_html = $(self.getTemplate({
							name: 'callflowKey',
							data: {
								items: {
									'_': self.i18n.active().callflows.menu.default_action,
									'timeout': 'timeout',
									'0': '0',
									'1': '1',
									'2': '2',
									'3': '3',
									'4': '4',
									'5': '5',
									'6': '6',
									'7': '7',
									'8': '8',
									'9': '9',
									'*': '*',
									'#': '#'
								},
								selected: child_node.key
							},
							submodule: 'menu'
						}));

						popup_html.find('#add').on('click', function() {
							child_node.key = $('#menu_key_selector', popup).val();

							child_node.key_caption = $('#menu_key_selector option:selected', popup).text();

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.menu.menu_option_title,
							minHeight: '0',
							beforeClose: function() {
								callback && callback();
							}
						});
					},
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this;

						self.menuList(function(menus) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(menus, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: menus,
									resource: 'menu',
									resourceId: 'menuId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}

							function renderPopup(itemNotFound) {
								popup_html = $(self.getTemplate({
									name: 'callflowEdit',
									data: {
										items: _.sortBy(menus, 'name'),
										selected: node.getMetadata('id') || ''
									},
									submodule: 'menu'
								}));

								var selector = popup_html.find('#menu_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Menu Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#menu_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#menu_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#menu_selector', popup_html).change(toggleSaveButton);

								if ($('#menu_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#menu_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.menuPopupEdit(_data, function(menu) {
										node.setMetadata('id', menu.id || 'null');
										node.caption = menu.name || '';

										popup.dialog('close');
									});
								});

								popup_html.find('#add').on('click', function() {
									node.setMetadata('id', $('#menu_selector', popup).val());
									node.caption = $('#menu_selector option:selected', popup).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.menu.menu_title,
									minHeight: '0',
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						});
					},
					listEntities: function(callback) {
						self.callApi({
							resource: 'menu.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: false
								}
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.menu.edit'
				}
			});
		},

		menuList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'menu.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		menuGet: function(menuId, callback) {
			var self = this;

			self.callApi({
				resource: 'menu.get',
				data: {
					accountId: self.accountId,
					menuId: menuId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		menuCreate: function(data, callback, error) {
			var self = this;

			self.callApi({
				resource: 'menu.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				},
				error: function(errorPayload, data, globalHandler) {
					error && error(errorPayload);

					//globalHandler(data, { generateError: true });
				}
			});
		},

		menuUpdate: function(data, callback, error) {
			var self = this;

			self.callApi({
				resource: 'menu.update',
				data: {
					accountId: self.accountId,
					menuId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				},
				error: function(errorPayload, data, globalHandler) {
					error && error(errorPayload);

					//globalHandler(data, { generateError: true });
				}
			});
		},

		menuDelete: function(menuId, callback) {
			var self = this;

			self.callApi({
				resource: 'menu.delete',
				data: {
					accountId: self.accountId,
					menuId: menuId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		menuSubmoduleButtons: function(data) {
			var existingItem = true;
			
			if (!data.id) {
				existingItem = false;
			}
			
			var self = this,
				buttons = $(self.getTemplate({
					name: 'submoduleButtons',
					data: {
						miscSettings: miscSettings,
						existingItem: existingItem,
						hideDelete: hideAdd.menu
					}
				}));
			
			$('.entity-header-buttons').empty();
			$('.entity-header-buttons').append(buttons);

			if (!data.id) {
				$('.delete', '.entity-header-buttons').addClass('disabled');
			}
		}
	};

	return app;
});
