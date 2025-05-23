define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		hideAdd = false,
		miscSettings = {};

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'groupsDefineActions',
			'callflows.groups.edit': '_groupsEdit',
			'callflows.groups.submoduleButtons': 'groupsSubmoduleButtons'
		},

		groupsRender: function(data, target, callbacks) {
			var self = this,
				groups_html = $(self.getTemplate({
					name: 'edit',
					data: {
						...data,
						hideAdd: hideAdd,
						miscSettings: miscSettings
					},
					submodule: 'groups'
				})),
				groupForm = groups_html.find('#group-form');

			monster.ui.validate(groupForm, {
				rules: {
					'name': {
						required: true
					}
				}
			});

			self.winkstartTabs(groups_html);

			$('#tab_users > .rows', groups_html).sortable({
				handle: '.column.first'
			});

			self.groupsRenderEndpointList(data, groups_html);

			// after rendering the rows apply odd/even classes
			self.groupsRenderTable(groups_html);

			$('#tab_users > .rows', groups_html).sortable({
				handle: '.column.first',
				update: function(event, ui) {
					// reapply odd/even classes after sorting
					self.groupsRenderTable(groups_html);
				}
			});
			
			$('.group-save', groups_html).click(function(ev) {
				saveButtonEvents(ev);
			});

			$('#submodule-buttons-container .save').click(function(ev) {
				saveButtonEvents(ev);
			});

			// add search to dropdown
			groups_html.find('#select_user_id').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			// add search to dropdown
			groups_html.find('#select_device_id').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			function saveButtonEvents(ev) {
				ev.preventDefault();

				var $this = $(this);

				if (!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if (monster.ui.valid(groupForm)) {
						var form_data = monster.ui.getFormData('group-form');
						self.groupsCleanFormData(form_data, data.field_data);

						form_data.endpoints = {};

						$('.rows .row:not(#row_no_data)', groups_html).each(function(k, v) {
							form_data.endpoints[$(v).data('id')] = {
								type: $(v).data('type'),
								weight: k + 1
							};
						});

						delete data.data.resources;
						delete data.data.endpoints;

						self.groupsSave(form_data, data, callbacks.save_success);
					} else {
						$this.removeClass('disabled');
						monster.ui.alert(self.i18n.active().callflows.groups.there_were_errors_on_the_form);
					}
				}
			};

			$('.group-delete', groups_html).click(function(ev) {
				deleteButtonEvents(ev);
			});

			$('#submodule-buttons-container .delete').click(function(ev) {
				deleteButtonEvents(ev);
			});

			function deleteButtonEvents(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.groups.are_you_sure_you_want_to_delete, function() {
					self.groupsDelete(data, callbacks.delete_success);
				});
			};

			var add_user = function() {
					var $user = $('#select_user_id', groups_html);

					if ($user.val() !== 'null') {
						var user_id = $user.val();

						$.each(data.field_data.users, function(k, v) {
							if (user_id === v.id) {
								var user_data = {
									endpoint_id: user_id,
									endpoint_type: 'user',
									endpoint_name: v.first_name + ' ' + v.last_name
								};

								data.data.endpoints.push(user_data);

								data.data.endpoints.sort(function(a, b) {
									return a.endpoint_name.toLowerCase() > b.endpoint_name.toLowerCase();
								});

								self.groupsRenderEndpointList(data, groups_html);
								//$user.val('empty_option_user');
								$user.val('null').trigger("chosen:updated");
							}
						});
					}
				},
				add_device = function() {
					var $device = $('#select_device_id', groups_html);

					if ($device.val() !== 'null') {
						var device_id = $device.val();

						$.each(data.field_data.devices, function(k, v) {
							if (device_id === v.id) {
								var device_data = {
									endpoint_id: device_id,
									endpoint_type: 'device',
									endpoint_name: v.name
								};

								data.data.endpoints.push(device_data);

								data.data.endpoints.sort(function(a, b) {
									return a.endpoint_name.toLowerCase() > b.endpoint_name.toLowerCase();
								});

								self.groupsRenderEndpointList(data, groups_html);
								//$device.val('empty_option_device');
								$device.val('null').trigger("chosen:updated");
							}
						});
					}
				};

			$('#select_user_id', groups_html).change(function() {
				add_user();
				self.groupsRenderTable(groups_html);
			});
			$('#select_device_id', groups_html).change(function() {
				add_device();
				self.groupsRenderTable(groups_html);
			});

			/*
			groups_html.find('#group-form').on('click', '.action_endpoint.delete', function() {

				var endpoint_id = $(this).data('id');
				//removes it from the grid
				$('#row_endpoint_' + endpoint_id, groups_html).remove();
				//re-add it to the dropdown
				$('#option_endpoint_' + endpoint_id, groups_html).show();
				//if grid empty, add no data line
				if ($('.rows .row', groups_html).size() === 0) {
					$('.rows', groups_html)
						.append($(self.getTemplate({
							name: 'endpoint_row',
							submodule: 'groups'
						})));
				}

				var new_list = [];

				$.each(data.data.endpoints, function(k, v) {
					if (!(v.endpoint_id === endpoint_id)) {
						new_list.push(v);
					}
				});

				data.data.endpoints = new_list;

				// reapply odd/even classes after the deletion
				self.groupsRenderTable(groups_html);

			});
			*/

			groups_html.find('#group-form').on('click', '.action_endpoint.delete', function() {

				var endpoint_id = $(this).data('id');
			
				// Removes it from the grid
				$('#row_endpoint_' + endpoint_id, groups_html).remove();
			
				// Re-add it to the dropdown
				$('#option_endpoint_' + endpoint_id, groups_html).prop('disabled', false).show();
				$('#select_user_id', groups_html).trigger("chosen:updated");
				$('#select_device_id', groups_html).trigger("chosen:updated");
			
				// If grid empty, add no data line
				if ($('.rows .row', groups_html).length === 0) {
					$('.rows', groups_html)
						.append($(self.getTemplate({
							name: 'endpoint_row',
							submodule: 'groups'
						})));
				}
			
				// Remove from the data array
				var new_list = data.data.endpoints.filter(v => v.endpoint_id !== endpoint_id);
				data.data.endpoints = new_list;
			
				// Reapply odd/even classes after the deletion
				self.groupsRenderTable(groups_html);
			
			});
			
			(target)
				.empty()
				.append(groups_html);
		},
		
		// Added for the subscribed event to avoid refactoring mediaEdit
		_groupsEdit: function(args) {
			var self = this;
			self.groupsEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		groupsEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#groups-content'),
				target = _target || $('#groups-view', parent),
				callbacks = {
					save_success: _callbacks.save_success,
					save_error: _callbacks.save_error,
					delete_success: _callbacks.delete_success,
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						endpoints: {},
						music_on_hold: {}
					}, data_defaults || {}),
					field_data: {}
				};

			if (miscSettings.callflowButtonsWithinHeader) {
				self.groupsSubmoduleButtons(data);
			};

			monster.parallel({
				device_list: function(callback) {
					self.groupsRequestDeviceList({
						success: function(data) {
							defaults.field_data.devices = data;
							callback(null, data);
						}
					});
				},
				user_list: function(callback) {
					self.groupsRequestUserList({
						success: function(data) {
							defaults.field_data.users = data;
							callback(null, {});
						}
					});
				},

				groups_get: function(callback) {
					if (typeof data === 'object' && data.id) {
						self.callApi({
							resource: 'group.get',
							data: {
								accountId: self.accountId,
								groupId: data.id
							},
							success: function(data) {
								callback(null, data);
							}
						});
					} else {
						callback(null, {});
					}
				}
			}, function(err, results) {
				var render_data = defaults;

				if (typeof data === 'object' && data.id) {
					render_data = $.extend(true, defaults, results.groups_get);
				}

				render_data = self.groupsFormatData(render_data);

				self.groupsRender(render_data, target, callbacks);
			});
		},
		

		groupsRenderEndpointList: function(data, parent) {
			var self = this;

			$('.rows', parent).empty();

			if ('endpoints' in data.data && data.data.endpoints.length > 0) {
				$.each(data.data.endpoints, function(k, item) {
					$('.rows', parent)
						.append($(self.getTemplate({
							name: 'endpoint_row',
							data: {
								...item,
								miscSettings: miscSettings
							},
							submodule: 'groups'
						})));
					$('#option_endpoint_' + item.endpoint_id, parent).hide();
				});
			} else {
				$('.rows', parent)
					.empty()
					.append($(self.getTemplate({
						name: 'endpoint_row',
						submodule: 'groups'
					})));
			}
		},

		groupsCleanFormData: function(form_data, field_data) {
			delete form_data.extra;
		},

		groupsFormatData: function(data) {
			var user_item,
				endpoint_item,
				list_endpoint = [];

			$.each(data.field_data.users, function(k, v) {
				if (v.id in data.data.endpoints) {
					endpoint_item = {
						endpoint_type: 'user',
						endpoint_id: v.id,
						endpoint_name: v.first_name + ' ' + v.last_name,
						endpoint_weight: data.data.endpoints[v.id].weight || 0
					};

					list_endpoint.push(endpoint_item);
				}
			});

			$.each(data.field_data.devices, function(k, v) {
				if (v.id in data.data.endpoints) {
					endpoint_item = {
						endpoint_type: 'device',
						endpoint_id: v.id,
						endpoint_name: v.name,
						endpoint_weight: data.data.endpoints[v.id].weight || 0
					};

					list_endpoint.push(endpoint_item);
				}
			});

			list_endpoint.sort(function(a, b) {
				return a.endpoint_weight - b.endpoint_weight;
			});

			data.data.endpoints = list_endpoint;

			return data;
		},

		groupsDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				hideCallflowAction = args.hideCallflowAction;

			// set hideAdd variable for use elsewhere
			hideAdd = args.hideAdd;
			miscSettings = args.miscSettings;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			};

			var actions = {
				'ring_group[]': {
					name: self.i18n.active().oldCallflows.ring_group,
					icon: 'ring_group',
					google_icon: 'group',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'ring_group',
					tip: self.i18n.active().oldCallflows.ring_group_tip,
					data: {
						name: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('ring_group[]'),
					weight: 20,
					caption: function(node) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						self.groupsEditRingGroup(node, callback);
					}
				},
				'groups': {
					name: self.i18n.active().callflows.groups.title,
					module: 'groups',
					listEntities: function(callback) {
						
						var groupFilters = {
							paginate: false
						};

						if (miscSettings.hidePrgFromGroupList) {
							groupFilters['filter_not_group_type'] = 'personal';
						}
						
						self.callApi({
							resource: 'group.list',
							data: {
								accountId: self.accountId,
								filters: groupFilters
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.groups.edit'
				},
				'page_group[]': {
					name: self.i18n.active().oldCallflows.page_group,
					icon: 'ring_group',
					google_icon: 'adaptive_audio_mic',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'page_group',
					tip: self.i18n.active().oldCallflows.page_group_tip,
					data: {
						name: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('page_group[]'),
					weight: 30,
					caption: function(node) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						self.groupsEditPageGroup(node, callback);
					}
				},

				/*'eavesdrop[]': {
					name: self.i18n.active().callflows.eavesdrop.name,
					icon: 'headset',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'eavesdrop',
					tip: self.i18n.active().callflows.eavesdrop.tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 48,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						self.groupsGetEndpoints(function(formattedData) {
							var popup, popup_html;

							popup_html = $(self.getTemplate({
								name: 'eavesdrop',
								data: {
									fieldData: formattedData,
									data: {
										'selectedId': node.getMetadata('device_id') || node.getMetadata('user_id') || '',
										'approvedId': node.getMetadata('approved_device_id') || node.getMetadata('approved_user_id') || node.getMetadata('approved_group_id') || ''
									}
								},
								submodule: 'groups'
							}));

							monster.ui.tooltips(popup_html);

							$('#add', popup_html).click(function() {
								var setData = function(field, value) {
									if (value === 'endpoint_empty') {
										node.deleteMetadata('user_id');
										node.deleteMetadata('device_id');
									} else if (value === 'approved_empty') {
										node.deleteMetadata('approved_user_id');
										node.deleteMetadata('approved_group_id');
										node.deleteMetadata('approved_device_id');
									} else {
										node.setMetadata(field, value);
									}
								};

								var endpointField = $('#endpoint_selector option:selected').data('type') + '_id',
									endpointVal = $('#endpoint_selector option:selected').val(),
									approvedEndpointField = 'approved_' + $('#approved_endpoint_selector option:selected').data('type') + '_id',
									approvedEndpointVal = $('#approved_endpoint_selector option:selected').val();

								setData(endpointField, endpointVal);
								setData(approvedEndpointField, approvedEndpointVal);

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.eavesdrop.title,
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						});
					}
				},*/

				/*'intercept[]': {
					name: self.i18n.active().callflows.intercept.name,
					icon: 'uturn_arrow',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'intercept',
					tip: self.i18n.active().callflows.intercept.tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 48,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						self.groupsGetEndpoints(function(formattedData) {
							var popup, popup_html;

							popup_html = $(self.getTemplate({
								name: 'intercept',
								data: {
									fieldData: formattedData,
									data: {
										'selectedId': node.getMetadata('device_id') || node.getMetadata('user_id') || '',
										'approvedId': node.getMetadata('approved_device_id') || node.getMetadata('approved_user_id') || node.getMetadata('approved_group_id') || ''
									}
								},
								submodule: 'groups'
							}));

							monster.ui.tooltips(popup_html);

							$('#add', popup_html).click(function() {
								var setData = function(field, value) {
									if (value === 'endpoint_empty') {
										node.deleteMetadata('user_id');
										node.deleteMetadata('device_id');
									} else if (value === 'approved_empty') {
										node.deleteMetadata('approved_user_id');
										node.deleteMetadata('approved_group_id');
										node.deleteMetadata('approved_device_id');
									} else {
										node.setMetadata(field, value);
									}
								};

								var endpointField = $('#endpoint_selector option:selected').data('type') + '_id',
									endpointVal = $('#endpoint_selector option:selected').val(),
									approvedEndpointField = 'approved_' + $('#approved_endpoint_selector option:selected').data('type') + '_id',
									approvedEndpointVal = $('#approved_endpoint_selector option:selected').val();

								setData(endpointField, endpointVal);
								setData(approvedEndpointField, approvedEndpointVal);

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.intercept.title,
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						});
					}
				},*/

				'ring_group_toggle[action=login]': {
					name: self.i18n.active().callflows.ringGroupToggle.loginTitle,
					icon: 'ring_group',
					google_icon: 'group_add',
					category: self.i18n.active().callflows.ringGroupToggle.category,
					module: 'ring_group_toggle',
					tip: self.i18n.active().callflows.ringGroupToggle.loginTip,
					data: {
						action: 'login',
						callflow_id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('ring_group_toggle[action=login]'),
					weight: 1,
					caption: function(node, caption_map) {
						var id = node.getMetadata('callflow_id'),
							return_value = '';

						if (id in caption_map) {
							if (caption_map[id].hasOwnProperty('name')) {
								return_value = caption_map[id].name;
							} else if (caption_map[id].hasOwnProperty('numbers')) {
								return_value = caption_map[id].numbers.toString();
							}
						}

						return return_value;
					},
					edit: function(node, callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: { 
									paginate: false
								}
							},
							success: function(data, status) {

								var popup, popup_html, _data = [];
	
								function filterCallflows(callflow, filterRingGroup) {
									if (!callflow.featurecode && callflow.id !== self.flow.id) {
										// additional filtering based on ringGroupToggleActionFilterCallflows
										if (filterRingGroup) {
											return callflow.modules.includes('ring_group') && callflow.type !== 'mainUserCallflow';
										}
										return true; // No additional filter needed
									}
									return false;
								}

								$.each(data.data, function() {
									if (filterCallflows(this, miscSettings.ringGroupToggleActionFilterCallflows)) {
										this.name = this.name || (this.numbers ? this.numbers.toString() : self.i18n.active().oldCallflows.no_numbers);
										_data.push(this);
									}
								});

								var selectedId = node.getMetadata('callflow_id') || '',
									selectedItem = _.find(_data, { id: selectedId });

								if (!selectedItem && selectedId) {
									self.checkItemExists({
										selectedId: selectedId,
										itemList: _data,
										resource: 'callflow',
										resourceId: 'callflowId',
										callback: function(itemNotFound) { 
											renderPopup(itemNotFound);
										}
									});
								} else {
									renderPopup(false);
								}

								function renderPopup(itemNotFound) {
									popup_html = $(self.getTemplate({
										name: 'ring_group_login_dialog',
										data: {
											objects: {
												type: 'callflow',
												items: _.sortBy(_data, 'name'),
												selected: node.getMetadata('callflow_id') || ''
											}
										},
										submodule: 'groups'
									}));

									var selector = popup_html.find('#object-selector');

									if (itemNotFound) {
										selector.attr("data-placeholder", "Configured Callflow Not Found").addClass("item-not-found").trigger("chosen:updated");
									}

									selector.on("change", function() {
										if ($(this).val() !== null) {
											$(this).removeClass("item-not-found");
										}
									});

									// add search to dropdown
									popup_html.find('#object-selector').chosen({
										width: '100%',
										disable_search_threshold: 0,
										search_contains: true
									}).on('chosen:showing_dropdown', function() {
										popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
									});

									popup_html.find('.select_wrapper').addClass('dialog_popup');

									// enable or disable the save button based on the dropdown value
									function toggleSaveButton() {
										var selectedValue = $('#object-selector', popup_html).val();
										
										if (selectedValue == 'null') {
											$('#add', popup_html).prop('disabled', true);
										} else {
											$('#add', popup_html).prop('disabled', false);
										}
									}

									toggleSaveButton();

									$('#object-selector', popup_html).change(toggleSaveButton);

									$('#add', popup_html).click(function() {
										node.setMetadata('callflow_id', $('#object-selector', popup_html).val());

										node.caption = $('#object-selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().callflows.ringGroupToggle.loginPopupTitle,
										beforeClose: function() {
											if (typeof callback === 'function') {
												callback();
											}
										}
									});
								}
							}
						});
					}
				},
				'ring_group_toggle[action=logout]': {
					name: self.i18n.active().callflows.ringGroupToggle.logoutTitle,
					icon: 'ring_group',
					google_icon: 'group_remove',
					category: self.i18n.active().callflows.ringGroupToggle.category,
					module: 'ring_group_toggle',
					tip: self.i18n.active().callflows.ringGroupToggle.logoutTip,
					data: {
						action: 'logout',
						callflow_id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('ring_group_toggle[action=logout]'),
					weight: 2,
					caption: function(node, caption_map) {
						var id = node.getMetadata('callflow_id'),
							return_value = '';

						if (id in caption_map) {
							if (caption_map[id].hasOwnProperty('name')) {
								return_value = caption_map[id].name;
							} else if (caption_map[id].hasOwnProperty('numbers')) {
								return_value = caption_map[id].numbers.toString();
							}
						}

						return return_value;
					},
					edit: function(node, callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: { paginate: false }
							},
							success: function(data, status) {
								var popup, popup_html, _data = [];

								function filterCallflows(callflow, filterRingGroup) {
									if (!callflow.featurecode && callflow.id !== self.flow.id) {
										// additional filtering based on ringGroupToggleActionFilterCallflows
										if (filterRingGroup) {
											return callflow.modules.includes('ring_group') && callflow.type !== 'mainUserCallflow';
										}
										return true; // No additional filter needed
									}
									return false;
								}

								$.each(data.data, function() {
									if (filterCallflows(this, miscSettings.ringGroupToggleActionFilterCallflows)) {
										this.name = this.name || (this.numbers ? this.numbers.toString() : self.i18n.active().oldCallflows.no_numbers);
										_data.push(this);
									}
								});

								var selectedId = node.getMetadata('callflow_id') || '',
									selectedItem = _.find(_data, { id: selectedId });

								if (!selectedItem && selectedId) {
									self.checkItemExists({
										selectedId: selectedId,
										itemList: _data,
										resource: 'callflow',
										resourceId: 'callflowId',
										callback: function(itemNotFound) { 
											renderPopup(itemNotFound);
										}
									});
								} else {
									renderPopup(false);
								}

								function renderPopup(itemNotFound) {
									popup_html = $(self.getTemplate({
										name: 'ring_group_logout_dialog',
										data: {
											objects: {
												type: 'callflow',
												items: _.sortBy(_data, 'name'),
												selected: node.getMetadata('callflow_id') || ''
											}
										},
										submodule: 'groups'
									}));

									var selector = popup_html.find('#object-selector');

									if (itemNotFound) {
										selector.attr("data-placeholder", "Configured Callflow Not Found").addClass("item-not-found").trigger("chosen:updated");
									}

									selector.on("change", function() {
										if ($(this).val() !== null) {
											$(this).removeClass("item-not-found");
										}
									});

									// add search to dropdown
									popup_html.find('#object-selector').chosen({
										width: '100%',
										disable_search_threshold: 0,
										search_contains: true
									}).on('chosen:showing_dropdown', function() {
										popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
									});

									popup_html.find('.select_wrapper').addClass('dialog_popup');

									// enable or disable the save button based on the dropdown value
									function toggleSaveButton() {
										var selectedValue = $('#object-selector', popup_html).val();
										
										if (selectedValue == 'null') {
											$('#add', popup_html).prop('disabled', true);
										} else {
											$('#add', popup_html).prop('disabled', false);
										}
									}

									toggleSaveButton();

									$('#object-selector', popup_html).change(toggleSaveButton);

									$('#add', popup_html).click(function() {
										node.setMetadata('callflow_id', $('#object-selector', popup_html).val());

										node.caption = $('#object-selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().callflows.ringGroupToggle.logoutPopupTitle,
										beforeClose: function() {
											if (typeof callback === 'function') {
												callback();
											}
										}
									});
								}
							}
						});
					}
				}
			}

			$.extend(callflow_nodes, actions);

		},

		groupsGetEndpoints: function(callback) {
			var self = this;

			monster.parallel({
				'group': function(callback) {
					self.groupsGroupList(function(data) {
						callback(null, data);
					});
				},
				'user': function(callback) {
					self.groupsRequestUserList({
						success: function(data) {
							callback(null, data);
						}
					});
				},
				'device': function(callback) {
					self.groupsRequestDeviceList({
						success: function(data) {
							callback(null, data);
						}
					});
				}
			}, function(err, results) {
				var data = self.groupsFormatEndpoints(results);

				callback(data);
			});
		},

		groupsFormatEndpoints: function(data) {
			_.each(data.user, function(user) {
				user.name = user.first_name + ' ' + user.last_name;
			});

			return data;
		},

		/*
		groupsEditPageGroup: function(node, callback) {
			var self = this;

			monster.waterfall([
				function(callback) {
					self.groupsRequestDeviceList({
						success: function(data) {
							callback(null, data);
						}
					});
				}
			], function(err, data) {
				var popup,
					popup_html,
					endpoints = node.getMetadata('endpoints'),
					selected_endpoints = {},
					unselected_endpoints = [],
					unselected_groups = [],
					unselected_devices = [],
					unselected_users = [];

				if (endpoints) {
					// We need to translate the endpoints to prevent nasty O(N^2) time complexities,
					// we also need to clone to prevent managing of objects
					$.each($.extend(true, {}, endpoints), function(i, obj) {
						obj.name = 'Undefined Device';
						selected_endpoints[obj.id] = obj;
					});
				}

				$.each(data, function(i, obj) {
					obj.endpoint_type = 'device';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'device';
						selected_endpoints[obj.id].owner_id = obj.owner_id;
						selected_endpoints[obj.id].name = obj.name;
					} else {
						unselected_devices.push(obj);
					}
				});

				unselected_devices = _.sortBy(unselected_devices, 'name');

				self.groupsGroupList(function(_data) {
					$.each(_data, function(i, obj) {
						obj.endpoint_type = 'group';
						if (obj.id in selected_endpoints) {
							selected_endpoints[obj.id].endpoint_type = 'group';
							selected_endpoints[obj.id].name = obj.name;
						} else {
							unselected_groups.push(obj);
						}
					});

					unselected_groups = _.sortBy(unselected_groups, 'name');

					monster.waterfall([
						function(callback) {
							self.groupsRequestUserList({
								success: function(data) {
									callback(null, data);
								}
							});
						}
					], function(err, _data) {
						$.each(_data, function(i, obj) {
							obj.name = obj.first_name + ' ' + obj.last_name;
							obj.endpoint_type = 'user';
							if (obj.id in selected_endpoints) {
								selected_endpoints[obj.id].endpoint_type = 'user';
								selected_endpoints[obj.id].name = obj.name;
							} else {
								unselected_users.push(obj);
							}
						});
						unselected_users = _.sortBy(unselected_users, 'name');

						popup_html = $(self.getTemplate({
							name: 'page_group_dialog',
							data: {
								form: {
									name: node.getMetadata('name') || '',
									audio: node.getMetadata('audio') || 'one-way'
								}
							},
							submodule: 'groups'
						}));
						$.each(unselected_groups, function() {
							$('#groups_pane .connect.left', popup_html)
								.append($(self.getTemplate({
									name: 'page_group_element',
									data: this,
									submodule: 'groups'
								})));
						});

						$.each(unselected_devices, function() {
							$('#devices_pane .connect.left', popup_html)
								.append($(self.getTemplate({
									name: 'page_group_element',
									data: this,
									submodule: 'groups'
								})));
						});

						$.each(unselected_users, function() {
							$('#users_pane .connect.left', popup_html)
								.append($(self.getTemplate({
									name: 'page_group_element',
									data: this,
									submodule: 'groups'
								})));
						});

						$.each(selected_endpoints, function() {
							//Check if user/device exists.
							if (this.endpoint_type) {
								$('.connect.right', popup_html)
									.append($(self.getTemplate({
										name: 'page_group_element',
										data: this,
										submodule: 'groups'
									})));
							}
						});

						$('#name', popup_html).bind('keyup blur change', function() {
							$('.column.right .title', popup_html).html('Page Group - ' + $(this).val());
						});

						$('ul.settings1 > li > a', popup_html).click(function(item) {
							$('.pane_content', popup_html).hide();

							//Reset Search field
							$('.searchfield', popup_html).val('');
							$('.column.left li', popup_html).show();

							$('ul.settings1 > li', popup_html).removeClass('current');

							var tab_id = $(this).attr('id');

							if (tab_id === 'users_tab_link') {
								$('#users_pane', popup_html).show();
							} else if (tab_id === 'devices_tab_link') {
								$('#devices_pane', popup_html).show();
							} else if (tab_id === 'groups_tab_link') {
								$('#groups_pane', popup_html).show();
							} else if (tab_id === 'personal_ring_groups_tab_link') {
								$('#groups_pane', popup_html).show();
							}

							$(this).parent().addClass('current');
						});

						$('.searchsubmit2', popup_html).click(function() {
							$('.searchfield', popup_html).val('');
							$('.column li', popup_html).show();
						});

						$('#devices_pane .searchfield', popup_html).keyup(function() {
							$('#devices_pane .column.left li').each(function() {
								if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#devices_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
									$(this).hide();
								} else {
									$(this).show();
								}
							});
						});

						$('#users_pane .searchfield', popup_html).keyup(function() {
							$('#users_pane .column.left li').each(function() {
								if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#users_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
									$(this).hide();
								} else {
									$(this).show();
								}
							});
						});

						$('#groups_pane .searchfield', popup_html).keyup(function() {
							$('#groups_pane .column.left li').each(function() {
								if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#groups_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
									$(this).hide();
								} else {
									$(this).show();
								}
							});
						});

						if ($.isEmptyObject(selected_endpoints)) {
							$('.column.right .connect', popup_html).addClass('no_element');
						} else {
							$('.column.right .connect', popup_html).removeClass('no_element');
						}

						$('.column.left .options', popup_html).hide();
						$('.column.left .actions', popup_html).hide();

						$('.options .option.delay', popup_html).bind('keyup', function() {
							$(this).parents('li').data('delay', $(this).val());
						});

						$('.options .option.timeout', popup_html).bind('keyup', function() {
							$(this).parents('li').data('timeout', $(this).val());
						});

						$('#save_ring_group', popup_html).click(function() {
							var name = $('#name', popup_html).val();
							var audio = $('#audio', popup_html).val();

							endpoints = [];

							$('.right .connect li', popup_html).each(function() {
								var item_data = $(this).data();
								delete item_data.owner_id;
								endpoints.push(item_data);
							});

							node.setMetadata('endpoints', endpoints);
							node.setMetadata('name', name);
							node.setMetadata('audio', audio);
							node.caption = name;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.page_group_title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});

						// $('.scrollable', popup).jScrollPane({
						// 	horizontalDragMinWidth: 0,
						// 	horizontalDragMaxWidth: 0
						// });

						$('.connect', popup).sortable({
							connectWith: $('.connect.right', popup),
							zIndex: 2000,
							helper: 'clone',
							appendTo: $('.wrapper', popup),
							scroll: false,
							tolerance: 'pointer',
							receive: function(ev, ui) {
								var data = ui.item[0].dataset,
									list_li = [],
									confirm_text;

								if (data.endpoint_type === 'device') {
									confirm_text = self.i18n.active().oldCallflows.the_owner_of_this_device_is_already;
									$('.connect.right li', popup_html).each(function() {
										if ($(this).data('id') === data.owner_id) {
											list_li.push($(this));
										}
									});
								} else if (data.endpoint_type === 'user') {
									confirm_text = self.i18n.active().oldCallflows.this_user_has_already_some_devices;
									$('.connect.right li', popup_html).each(function() {
										if ($(this).data('owner_id') === data.id) {
											list_li.push($(this));
										}
									});
								}

								if (list_li.length > 0) {
									monster.ui.confirm(confirm_text,
										function() {
											$.each(list_li, function() {
												remove_element(this);
											});
										},
										function() {
											remove_element(ui.item);
										}
									);
								}

								if ($(this).hasClass('right')) {
									$('.options', ui.item).show();
									$('.actions', ui.item).show();
									//$('.item_name', ui.item).addClass('right');
									$('.column.right .connect', popup).removeClass('no_element');
								}
							}
						});

						$(popup_html).delegate('.trash', 'click', function() {
							var $parent_li = $(this).parents('li').first();
							remove_element($parent_li);
						});

						$('.pane_content', popup_html).hide();
						$('#users_pane', popup_html).show();

						var remove_element = function(li) {
							var $parent_li = li;
							var data = $parent_li.data();
							data.name = jQuery.trim($('.item_name', $parent_li).html());
							$('#' + data.endpoint_type + 's_pane .connect.left', popup_html)
								.append($(self.getTemplate({
									name: 'page_group_element',
									data: data,
									submodule: 'groups'
								})));
							$parent_li.remove();

							if ($('.connect.right li', popup_html).size() === 0) {
								$('.column.right .connect', popup).addClass('no_element');
							}

							if (data.name.toLowerCase().indexOf($('#' + data.endpoint_type + 's_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
								$('#' + data.id, popup_html).hide();
							}
						};
					});
				});
			});
		},

		*/


		groupsEditPageGroup: function(node, callback) {
			var self = this;

			monster.parallel({
				unfilteredDevices: function(callback) {
					self.groupsRequestDeviceList({
						success: function(data) {
							callback(null, data);
						}
					}, false);
				},
				filteredDevices: function(callback) {
					self.groupsRequestDeviceList({
						success: function(data) {
							callback(null, data);
						}
					}, true);
				},
				unfilteredGroups: function(callback) {
					self.groupsGroupList(function(data) {
						callback(null, data);
					}, false);
				},
				filteredGroups: function(callback) {
					self.groupsGroupList(function(data) {
						callback(null, data);
					}, true);
				},
				users: function(callback) {
					self.groupsRequestUserList({
						success: function(data) {
							callback(null, data);
						}
					});
				}
			}, function(err, results) {
				
				if (err) {
					console.error('Error occurred while fetching data:', err);
					return;
				}

				var popup,
					popup_html,
					endpoints = node.getMetadata('endpoints'),
					selected_endpoints = {},
					unselected_endpoints = [],
					unselected_groups = [],
					unselected_filtered_groups = [],
					unselected_devices = [],
					unselected_filtered_devices = [],
					unselected_users = [];
					unfilteredDevices = results.unfilteredDevices,
					filteredDevices = results.filteredDevices,
					unfilteredGroups = results.unfilteredGroups,
					filteredGroups = results.filteredGroups,
					users = results.users;

				if (endpoints) {
					// We need to translate the endpoints to prevent nasty O(N^2) time complexities,
					// we also need to clone to prevent managing of objects
					$.each($.extend(true, {}, endpoints), function(i, obj) {
						obj.name = 'Undefined Device';
						selected_endpoints[obj.id] = obj;
					});
				}

				// populate unselected_devices without the filter
				$.each(unfilteredDevices, function(i, obj) {
					obj.endpoint_type = 'device';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'device';
						selected_endpoints[obj.id].owner_id = obj.owner_id;
						selected_endpoints[obj.id].name = obj.name;
					} else {
						unselected_devices.push(obj);
					}
				});

				unselected_devices = _.sortBy(unselected_devices, 'name');

				// populate unselected_filtered_devices with the filter
				$.each(filteredDevices, function(i, obj) {
					obj.endpoint_type = 'device';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'device';
						selected_endpoints[obj.id].owner_id = obj.owner_id;
						selected_endpoints[obj.id].name = obj.name;
					} else {
						unselected_filtered_devices.push(obj);
					}
				});

				unselected_filtered_devices = _.sortBy(unselected_filtered_devices, 'name');

				// populate unselected groups without filter
				$.each(unfilteredGroups, function(i, obj) {
					obj.endpoint_type = 'group';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'group';
						selected_endpoints[obj.id].name = obj.name;
					} else {
						unselected_groups.push(obj);
					}
				});

				unselected_groups = _.sortBy(unselected_groups, 'name');

				// populate unselected groups with filter
				$.each(filteredGroups, function(i, obj) {
					obj.endpoint_type = 'group';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'group';
						selected_endpoints[obj.id].name = obj.name;
					} else {
						unselected_filtered_groups.push(obj);
					}
				});

				unselected_filtered_groups = _.sortBy(unselected_filtered_groups, 'name');

				// populate unselected users
				$.each(users, function(i, obj) {
					obj.name = obj.first_name + ' ' + obj.last_name;
					obj.endpoint_type = 'user';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'user';
						selected_endpoints[obj.id].name = obj.name;
					} else {
						unselected_users.push(obj);
					}
				});

				unselected_users = _.sortBy(unselected_users, 'name');

				popup_html = $(self.getTemplate({
					name: 'page_group_dialog',
					data: {
						form: {
							name: node.getMetadata('name') || '',
							audio: node.getMetadata('audio') || 'one-way'
						},
						miscSettings: miscSettings
					},
					submodule: 'groups'
				}));

				// append unselected groups without filter
				$.each(unselected_groups, function() {
					$('#groups_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'page_group_element',
							data: this,
							submodule: 'groups'
						})));
				});

				// append unselected groups with filter
				$.each(unselected_filtered_groups, function() {
					$('#personal_ring_groups_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'page_group_element',
							data: this,
							submodule: 'groups'
						})));
				})

				// append unselected devices without filter
				$.each(unselected_devices, function() {
					$('#devices_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'page_group_element',
							data: this,
							submodule: 'groups'
						})));
				});

				// append unselected devices with filter
				$.each(unselected_filtered_devices, function() {
					$('#phone_only_devices_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'page_group_element',
							data: this,
							submodule: 'groups'
						})));
				});

				$.each(unselected_users, function() {
					$('#users_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'page_group_element',
							data: this,
							submodule: 'groups'
						})));
				});

				$.each(selected_endpoints, function() {
					//Check if user/device exists.
					if (this.endpoint_type) {
						$('.connect.right', popup_html)
							.append($(self.getTemplate({
								name: 'page_group_element',
								data: this,
								submodule: 'groups'
							})));
					}
				});

				$('#name', popup_html).bind('keyup blur change', function() {
					$('.column.right .title', popup_html).html('Page Group - ' + $(this).val());
				});

				// Listen for change events on the dropdown
				$('#settings-dropdown', popup_html).change(function() {
					// Hide all pane contents
					$('.pane_content', popup_html).hide();

					// Reset Search field
					$('.searchfield', popup_html).val('');
					$('.column.left li', popup_html).show();

					// Get the selected value from the dropdown
					var selectedValue = $(this).val();

					// Show the appropriate pane based on the selected value
					if (selectedValue === 'users_pane') {
						$('#users_pane', popup_html).show();
					} else if (selectedValue === 'devices_pane') {
						$('#devices_pane', popup_html).show();
					} else if (selectedValue === 'phone_only_devices_pane') {
						$('#phone_only_devices_pane', popup_html).show();
					} else if (selectedValue === 'groups_pane') {
						$('#groups_pane', popup_html).show();
					} else if (selectedValue === 'personal_ring_groups_pane') {
						$('#personal_ring_groups_pane', popup_html).show();
					}
				});

				// Trigger change event on page load to show the first pane
				$('#settings-dropdown', popup_html).trigger('change');

				$('.searchsubmit2', popup_html).click(function() {
					$('.searchfield', popup_html).val('');
					$('.column li', popup_html).show();
				});

				$('#devices_pane .searchfield', popup_html).keyup(function() {
					$('#devices_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#devices_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				$('#phone_only_devices_pane .searchfield', popup_html).keyup(function() {
					$('#phone_only_devices_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#phone_only_devices_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				$('#groups_pane .searchfield', popup_html).keyup(function() {
					$('#groups_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#groups_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				$('#personal_ring_groups_pane .searchfield', popup_html).keyup(function() {
					$('#personal_ring_groups_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#personal_ring_groups_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				$('#users_pane .searchfield', popup_html).keyup(function() {
					$('#users_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#users_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				if ($.isEmptyObject(selected_endpoints)) {
					$('.column.right .connect', popup_html).addClass('no_element');
				} else {
					$('.column.right .connect', popup_html).removeClass('no_element');
				}

				$('.column.left .options', popup_html).hide();
				$('.column.left .actions', popup_html).hide();

				$('.options .option.delay', popup_html).bind('keyup', function() {
					$(this).parents('li').data('delay', $(this).val());
				});

				$('.options .option.timeout', popup_html).bind('keyup', function() {
					$(this).parents('li').data('timeout', $(this).val());
				});

				$('#save_ring_group', popup_html).click(function() {
					var name = $('#name', popup_html).val();
					var audio = $('#audio', popup_html).val();

					endpoints = [];

					$('.right .connect li', popup_html).each(function() {
						var item_data = $(this).data();
						delete item_data.owner_id;
						endpoints.push(item_data);
					});

					node.setMetadata('endpoints', endpoints);
					node.setMetadata('name', name);
					node.setMetadata('audio', audio);
					node.caption = name;

					popup.dialog('close');
				});

				popup = monster.ui.dialog(popup_html, {
					title: self.i18n.active().oldCallflows.page_group_title,
					beforeClose: function() {
						if (typeof callback === 'function') {
							callback();
						}
					}
				});

				// $('.scrollable', popup).jScrollPane({
				// 	horizontalDragMinWidth: 0,
				// 	horizontalDragMaxWidth: 0
				// });

				$('.connect', popup).sortable({
					connectWith: $('.connect.right', popup),
					zIndex: 2000,
					helper: 'clone',
					appendTo: $('.wrapper', popup),
					scroll: false,
					tolerance: 'pointer',
					receive: function(ev, ui) {
						var data = ui.item[0].dataset,
							list_li = [],
							confirm_text;

						if (data.endpoint_type === 'device') {
							confirm_text = self.i18n.active().oldCallflows.the_owner_of_this_device_is_already;
							$('.connect.right li', popup_html).each(function() {
								if ($(this).data('id') === data.owner_id) {
									list_li.push($(this));
								}
							});
						} else if (data.endpoint_type === 'user') {
							confirm_text = self.i18n.active().oldCallflows.this_user_has_already_some_devices;
							$('.connect.right li', popup_html).each(function() {
								if ($(this).data('owner_id') === data.id) {
									list_li.push($(this));
								}
							});
						}

						if (list_li.length > 0) {
							monster.ui.confirm(confirm_text,
								function() {
									$.each(list_li, function() {
										remove_element(this);
									});
								},
								function() {
									remove_element(ui.item);
								}
							);
						}

						if ($(this).hasClass('right')) {
							$('.options', ui.item).show();
							$('.actions', ui.item).show();
							//$('.item_name', ui.item).addClass('right');
							$('.column.right .connect', popup).removeClass('no_element');
						}
					}
				});

				$(popup_html).delegate('.trash', 'click', function() {
					var $parent_li = $(this).parents('li').first();
					remove_element($parent_li);
				});

				$('.pane_content', popup_html).hide();
				
				// set the default tab when loaded
				if (miscSettings.filterRingGroupLists) {
					$('#personal_ring_groups_pane', popup_html).show();
				} else {
					$('#users_pane', popup_html).show();
				}

				var remove_element = function(li) {
					var $parent_li = li;
					var data = $parent_li.data();
					data.name = jQuery.trim($('.item_name', $parent_li).html());
					$('#' + data.endpoint_type + 's_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'page_group_element',
							data: data,
							submodule: 'groups'
						})));
					$parent_li.remove();

					if ($('.connect.right li', popup_html).size() === 0) {
						$('.column.right .connect', popup).addClass('no_element');
					}

					if (data.name.toLowerCase().indexOf($('#' + data.endpoint_type + 's_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
						$('#' + data.id, popup_html).hide();
					}
				};

				// enable or disable the save button based on the dropdown value
				function toggleSaveButton() {
    				var ulElement = document.querySelector('ul.connect.right.ui-sortable'),
    					numberOfItems = ulElement.querySelectorAll('li.sortable_li').length,
						groupName = document.querySelector('#name').value;

					if (numberOfItems > 0 && groupName != '') {
						$('#save_ring_group', popup_html).prop('disabled', false);
					} else {
						$('#save_ring_group', popup_html).prop('disabled', true);
					}
				}

				toggleSaveButton();

				// monitor for changes to the selected column
				var observer = new MutationObserver(toggleSaveButton),
					selectedColumn = popup.find('.right').get(0),
					config = { childList: true, subtree: true };

				observer.observe(selectedColumn, config);

				popup.on('dialogclose', function() {
					observer.disconnect();
				});
			});
		},

		groupsEditRingGroup: function(node, callback) {
			var self = this,
				default_timeout = '20',
				default_delay = '0';
		
			monster.parallel({
				unfilteredDevices: function(callback) {
					self.groupsRequestDeviceList({
						success: function(data) {
							callback(null, data);
						}
					}, false);
				},
				filteredDevices: function(callback) {
					self.groupsRequestDeviceList({
						success: function(data) {
							callback(null, data);
						}
					}, true);
				},
				unfilteredGroups: function(callback) {
					self.groupsGroupList(function(data) {
						callback(null, data);
					}, false);
				},
				filteredGroups: function(callback) {
					self.groupsGroupList(function(data) {
						callback(null, data);
					}, true);
				},
				users: function(callback) {
					self.groupsRequestUserList({
						success: function(data) {
							callback(null, data);
						}
					});
				},
				media: function(callback) {
					self.groupsMediaList(function(data) {
						callback(null, data);
					});
				}			
			}, function(err, results) {
				
				if (err) {
					console.error('Error occurred while fetching data:', err);
					return;
				}
		
				var popup,
					popup_html,
					endpoints = node.getMetadata('endpoints'),
					selected_endpoints = {},
					unselected_endpoints = [],
					unselected_groups = [],
					unselected_filtered_groups = [],
					unselected_devices = [],
					unselected_filtered_devices = [],
					unselected_users = [],
					unfilteredDevices = results.unfilteredDevices,
					filteredDevices = results.filteredDevices,
					unfilteredGroups = results.unfilteredGroups,
					filteredGroups = results.filteredGroups,
					users = results.users,
					media = results.media;

				if (endpoints) {
					// We need to translate the endpoints to prevent nasty O(N^2) time complexities,
					// we also need to clone to prevent managing of objects
					$.each($.extend(true, {}, endpoints), function(i, obj) {
						obj.name = self.i18n.active().oldCallflows.undefined_device;
						selected_endpoints[obj.id] = obj;
					});
				}

				// populate unselected_devices without the filter
				$.each(unfilteredDevices, function(i, obj) {
					obj.endpoint_type = 'device';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'device';
						selected_endpoints[obj.id].owner_id = obj.owner_id;
						selected_endpoints[obj.id].name = obj.name;
					} else {
						obj.delay = default_delay;
						obj.timeout = default_timeout;
						unselected_devices.push(obj);
					}
				});

				unselected_devices = _.sortBy(unselected_devices, 'name');

				// populate unselected_filtered_devices with the filter
				$.each(filteredDevices, function(i, obj) {
					obj.endpoint_type = 'device';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'device';
						selected_endpoints[obj.id].owner_id = obj.owner_id;
						selected_endpoints[obj.id].name = obj.name;
					} else {
						obj.delay = default_delay;
						obj.timeout = default_timeout;
						unselected_filtered_devices.push(obj);
					}
				});

				unselected_filtered_devices = _.sortBy(unselected_filtered_devices, 'name');

				// populate unselected groups without filter
				$.each(unfilteredGroups, function(i, obj) {
					obj.endpoint_type = 'group';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'group';
						selected_endpoints[obj.id].name = obj.name;
					} else {
						obj.delay = default_delay;
						obj.timeout = default_timeout;
						unselected_groups.push(obj);
					}
				});

				unselected_groups = _.sortBy(unselected_groups, 'name');

				// populate unselected groups with filter
				$.each(filteredGroups, function(i, obj) {
					obj.endpoint_type = 'group';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'group';
						selected_endpoints[obj.id].name = obj.name;
					} else {
						obj.delay = default_delay;
						obj.timeout = default_timeout;
						unselected_filtered_groups.push(obj);
					}
				});

				unselected_filtered_groups = _.sortBy(unselected_filtered_groups, 'name');

				// populate unselected users
				$.each(users, function(i, obj) {
					obj.name = obj.first_name + ' ' + obj.last_name;
					obj.endpoint_type = 'user';
					if (obj.id in selected_endpoints) {
						selected_endpoints[obj.id].endpoint_type = 'user';
						selected_endpoints[obj.id].name = obj.name;
					} else {
						obj.delay = default_delay;
						obj.timeout = default_timeout;
						unselected_users.push(obj);
					}
				});

				unselected_users = _.sortBy(unselected_users, 'name');

				// process media list
				var media_array = media.sort(function(a, b) {
					return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
				}),
				mediaId = node.getMetadata('ringback') || 'default',
				isShoutcast = mediaId.indexOf('://') >= 0 && mediaId !== 'silence_stream://300000',
				strategy = node.getMetadata('strategy');

				popup_html = $(self.getTemplate({
					name: 'ring_group_dialog',
					data: {
						form: {
							name: node.getMetadata('name') || '',
							strategy: {
								items: [
									{
										id: 'simultaneous',
										name: self.i18n.active().oldCallflows.at_the_same_time
									},
									{
										id: 'single',
										name: self.i18n.active().oldCallflows.in_order
									}
								],
								selected: node.getMetadata('strategy') || 'simultaneous'
							},
							timeout: node.getMetadata('timeout') || '30',
							repeats: node.getMetadata('repeats') || 1,
							ringback: {
								items: $.merge([
									{
										id: 'default',
										name: self.i18n.active().oldCallflows.default,
										class: 'uneditable'
									},
									{
										id: 'silence_stream://300000',
										name: self.i18n.active().oldCallflows.silence,
										class: 'uneditable'
									},
									{
										id: 'shoutcast_url',
										name: self.i18n.active().callflows.media.shoutcastURL,
										class: 'uneditable'
									}
								], media_array),
								selected: isShoutcast ? 'shoutcast_url' : mediaId,
								shoutcastValue: mediaId
							}
						},
						miscSettings: miscSettings
					},
					submodule: 'groups'
				}));

				// append unselected groups without filter
				$.each(unselected_groups, function() {
					$('#groups_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'ring_group_element',
							data: this,
							submodule: 'groups'
						})));
				});

				// append unselected groups with filter
				$.each(unselected_filtered_groups, function() {
					$('#personal_ring_groups_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'ring_group_element',
							data: this,
							submodule: 'groups'
						})));
				})

				// append unselected devices without filter
				$.each(unselected_devices, function() {
					$('#devices_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'ring_group_element',
							data: this,
							submodule: 'groups'
						})));
				});

				// append unselected devices with filter
				$.each(unselected_filtered_devices, function() {
					$('#phone_only_devices_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'ring_group_element',
							data: this,
							submodule: 'groups'
						})));
				});

				$.each(unselected_users, function() {
					$('#users_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'ring_group_element',
							data: this,
							submodule: 'groups'
						})));
				});

				$.each(selected_endpoints, function() {
					//Check if user/device exists.
					if (this.endpoint_type) {
						$('.connect.right', popup_html)
							.append($(self.getTemplate({
								name: 'ring_group_element',
								data: this,
								submodule: 'groups'
							})));
					}
				});

				//Hide delay column if ring strategy is set to 'In order'
				if (strategy === 'single') {
					$('.options .option.delay', popup_html).hide();
				}

				$('#name', popup_html).bind('keyup blur change', function() {
					$('.column.right .title', popup_html).html(self.i18n.active().oldCallflows.ring_group_val + $(this).val());
				});

				$('#ringback', popup_html).change(function(e) {
					var val = $(this).val(),
						isShoutcast = val === 'shoutcast_url';

					popup_html.find('.shoutcast-div').toggleClass('hidden', !isShoutcast).find('input').val('');

					if ($(this).find('option:selected').hasClass('uneditable')) {
						$('.media_action[data-action="edit"]', popup_html).hide();
					} else {
						$('.media_action[data-action="edit"]', popup_html).show();
					}
				});

				$('.media_action', popup_html).click(function(e) {
					var isCreation = $(this).data('action') === 'create',
						mediaData = isCreation ? {} : { id: $('#ringback', popup_html).val() };

					monster.pub('callflows.media.editPopup', {
						data: mediaData,
						callback: function(_mediaData) {
							if (_mediaData) {
								if (isCreation) {
									$('#ringback', popup_html).append('<option value="' + _mediaData.id + '">' + _mediaData.name + '</option>');
								} else {
									$('#ringback option[value="' + _mediaData.id + '"]', popup_html).text(_mediaData.name);
								}
								$('#ringback', popup_html).val(_mediaData.id);
							}
						}
					});
				});

				// Listen for change events on the dropdown
				$('#settings-dropdown', popup_html).change(function() {
					// Hide all pane contents
					$('.pane_content', popup_html).hide();

					// Reset Search field
					$('.searchfield', popup_html).val('');
					$('.column.left li', popup_html).show();

					// Get the selected value from the dropdown
					var selectedValue = $(this).val();

					// Show the appropriate pane based on the selected value
					if (selectedValue === 'users_pane') {
						$('#users_pane', popup_html).show();
					} else if (selectedValue === 'devices_pane') {
						$('#devices_pane', popup_html).show();
					} else if (selectedValue === 'phone_only_devices_pane') {
						$('#phone_only_devices_pane', popup_html).show();
					} else if (selectedValue === 'groups_pane') {
						$('#groups_pane', popup_html).show();
					} else if (selectedValue === 'personal_ring_groups_pane') {
						$('#personal_ring_groups_pane', popup_html).show();
					}
				});

				// Trigger change event on page load to show the first pane
				$('#settings-dropdown', popup_html).trigger('change');
				

				$('.searchsubmit2', popup_html).click(function() {
					$('.searchfield', popup_html).val('');
					$('.column li', popup_html).show();
				});

				$('#devices_pane .searchfield', popup_html).keyup(function() {
					$('#devices_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#devices_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				$('#phone_only_devices_pane .searchfield', popup_html).keyup(function() {
					$('#phone_only_devices_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#phone_only_devices_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				$('#groups_pane .searchfield', popup_html).keyup(function() {
					$('#groups_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#groups_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				$('#personal_ring_groups_pane .searchfield', popup_html).keyup(function() {
					$('#personal_ring_groups_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#personal_ring_groups_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				$('#users_pane .searchfield', popup_html).keyup(function() {
					$('#users_pane .column.left li').each(function() {
						if ($('.item_name', $(this)).html().toLowerCase().indexOf($('#users_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
							$(this).hide();
						} else {
							$(this).show();
						}
					});
				});

				if ($.isEmptyObject(selected_endpoints)) {
					$('.column.right .connect', popup_html).addClass('no_element');
				} else {
					$('.column.right .connect', popup_html).removeClass('no_element');
				}

				$('.column.left .options', popup_html).hide();
				$('.column.left .actions', popup_html).hide();

				$('.options .option.delay', popup_html).bind('keyup', function() {
					$(this).parents('li').data('delay', $(this).val());
				});

				$('.options .option.timeout', popup_html).bind('keyup', function() {
					$(this).parents('li').data('timeout', $(this).val());
				});

				$('#strategy', popup_html).bind('change', function() {
					var strategy = $(this).val(),
						$delay = $('.options .option.delay', popup_html);
						$delayTitle = $('.options .delay_title', popup_html);

					if (strategy === 'single') {
						$delay.hide();
						$delayTitle.hide();
					} else {
						$delay.show();
						$delayTitle.show();
					}
				});

				$('#save_ring_group', popup_html).click(function() {
					var name = $('#name', popup_html).val(),
						global_timeout = 0,
						strategy = $('#strategy', popup_html).val(),
						ringback = $('#ringback', popup_html).val(),
						repeats = $('#repeats', popup_html).val(),
						shoutcastValue = $('.shoutcast-url-input', popup_html).val();

					if (ringback === 'shoutcast_url') {
						ringback = shoutcastValue;
					}

					endpoints = [];

					if (strategy === 'simultaneous') {
						var computeTimeout = function(delay, local_timeout, global_timeout) {
							var duration = delay + local_timeout;

							if (duration > global_timeout) {
								global_timeout = duration;
							}

							return global_timeout;
						};
					} else {
						var computeTimeout = function(delay, local_timeout, global_timeout) {
							global_timeout += local_timeout;

							return global_timeout;
						};
					}

					$('.right .connect li', popup_html).each(function() {
						var item_data = $(this).data();

						if (strategy === 'single') {
							delete item_data.delay;
						}
						delete item_data.owner_id;
						endpoints.push(item_data);
						global_timeout = computeTimeout(parseFloat(item_data.delay), parseFloat(item_data.timeout), global_timeout);
					});

					if (repeats < 1) {
						repeats = 1;
					}

					node.setMetadata('endpoints', endpoints);
					node.setMetadata('name', name);
					node.setMetadata('strategy', strategy);
					node.setMetadata('timeout', global_timeout);
					node.setMetadata('repeats', repeats);
					if (ringback === 'default') {
						node.deleteMetadata('ringback', ringback);
					} else {
						node.setMetadata('ringback', ringback);
					}

					node.caption = name;

					popup.dialog('close');
				});

				monster.ui.tooltips(popup_html);

				popup = monster.ui.dialog(popup_html, {
					title: self.i18n.active().oldCallflows.ring_group,
					beforeClose: function() {
						if (typeof callback === 'function') {
							callback();
						}
					}
				});

				// $('.scrollable', popup).jScrollPane({
				// 	horizontalDragMinWidth: 0,
				// 	horizontalDragMaxWidth: 0
				// });

				$('.connect', popup).sortable({
					connectWith: $('.connect.right', popup),
					zIndex: 2000,
					helper: 'clone',
					appendTo: $('.wrapper', popup),
					scroll: false,
					tolerance: 'pointer',
					receive: function(ev, ui) {
						var data = ui.item[0].dataset,
							list_li = [],
							confirm_text;

						if (data.endpoint_type === 'device') {
							confirm_text = self.i18n.active().oldCallflows.the_owner_of_this_device_is_already;
							$('.connect.right li', popup_html).each(function() {
								if ($(this).data('id') === data.owner_id) {
									list_li.push($(this));
								}
							});
						} else if (data.endpoint_type === 'user') {
							confirm_text = self.i18n.active().oldCallflows.this_user_has_already_some_devices;
							$('.connect.right li', popup_html).each(function() {
								if ($(this).data('owner_id') === data.id) {
									list_li.push($(this));
								}
							});
						}

						if (list_li.length > 0) {
							monster.ui.confirm(confirm_text,
								function() {
									$.each(list_li, function() {
										remove_element(this);
									});
								},
								function() {
									remove_element(ui.item);
								}
							);
						}

						if ($(this).hasClass('right')) {
							$('.options', ui.item).show();
							$('.actions', ui.item).show();
							//$('.item_name', ui.item).addClass('right');
							$('.column.right .connect', popup).removeClass('no_element');
						}
					}
				});

				$(popup_html).delegate('.trash', 'click', function() {
					var $parent_li = $(this).parents('li').first();
					remove_element($parent_li);
				});

				$('.pane_content', popup_html).hide();
				
				// set the default tab when loaded
				if (miscSettings.filterRingGroupLists) {
					$('#personal_ring_groups_pane', popup_html).show();
				} else {
					$('#users_pane', popup_html).show();
				}
				//$('#users_pane', popup_html).show();
				//$('#personal_ring_groups_pane', popup_html).show();
				if ($('#ringback option:selected').hasClass('uneditable')) {
					$('.media_action[data-action="edit"]', popup_html).hide();
				} else {
					$('.media_action[data-action="edit"]', popup_html).show();
				}

				var remove_element = function(li) {
					var $parent_li = li;
					var data = $parent_li.data();
					data.name = jQuery.trim($('.item_name', $parent_li).html());
					$('#' + data.endpoint_type + 's_pane .connect.left', popup_html)
						.append($(self.getTemplate({
							name: 'ring_group_element',
							data: data,
							submodule: 'groups'
						})));
					$parent_li.remove();

					if ($('.connect.right li', popup_html).size() === 0) {
						$('.column.right .connect', popup).addClass('no_element');
					}

					if (data.name.toLowerCase().indexOf($('#' + data.endpoint_type + 's_pane .searchfield', popup_html).val().toLowerCase()) === -1) {
						$('#' + data.id, popup_html).hide();
					}
				};

				// alert for invalid ring attempts per member
				$('#repeats', popup_html).change(function() {
								
					repeatsValue = $('#repeats', popup_html).val();

					if (repeatsValue < 1 || repeatsValue > 99) {
						$('#repeats', popup_html).val(1);
						monster.ui.alert('warning', self.i18n.active().oldCallflows.ring_group_attempts_per_member_invalid);
					}
				
				});

				// enable or disable the save button based on the dropdown value
				function toggleSaveButton() {
    				var ulElement = document.querySelector('ul.connect.right.ui-sortable'),
    					numberOfItems = ulElement.querySelectorAll('li.sortable_li').length,
						groupName = document.querySelector('#name').value;

					if (numberOfItems > 0 && groupName != '') {
						$('#save_ring_group', popup_html).prop('disabled', false);
					} else {
						$('#save_ring_group', popup_html).prop('disabled', true);
					}
				}

				toggleSaveButton();

				// monitor for changes to the selected column
				var observer = new MutationObserver(toggleSaveButton),
					selectedColumn = popup.find('.right').get(0),
					config = { childList: true, subtree: true };

				observer.observe(selectedColumn, config);

				popup.on('dialogclose', function() {
					observer.disconnect();
				});

			});
		},

		groupsGroupList: function(callback, applyFilter) {
			var self = this;

			// this is the function to get groups within ring groups - need to add a setting to include or exclude personal groups
			var groupFilters = {
				paginate: false
			};

			if (miscSettings.filterRingGroupLists && !applyFilter) {
				groupFilters['filter_not_group_type'] = 'personal';
			}

			if (miscSettings.filterRingGroupLists && applyFilter) {
				groupFilters['filter_group_type'] = 'personal';
			}

			self.callApi({
				resource: 'group.list',
				data: {
					accountId: self.accountId,
					filters: groupFilters
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		groupsMediaList: function(callback) {
			var self = this;

			var mediaFilters = {
				paginate: false
			};

			if (miscSettings.filterRingGroupLists && miscSettings.hideMailboxMedia) {
				mediaFilters['filter_not_media_source'] = 'recording';
			}


			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: mediaFilters
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		groupsNormalizeData: function(form_data) {
			delete form_data.users;
			return form_data;
		},

		groupsSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.groupsNormalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data === 'object' && data.data.id) {
				self.callApi({
					resource: 'group.update',
					data: {
						accountId: self.accountId,
						groupId: data.data.id,
						data: normalized_data
					},
					success: function(_data) {
						success(_data.data, status, 'update');
					}
				});
			} else {
				self.callApi({
					resource: 'group.create',
					data: {
						accountId: self.accountId,
						data: normalized_data
					},
					success: function(_data) {
						success(_data.data, status, 'create');
					}
				});
			}
		},

		groupsDelete: function(data, callback) {
			var self = this;

			if (typeof data.data === 'object' && data.data.id) {
				self.callApi({
					resource: 'group.delete',
					data: {
						accountId: self.accountId,
						groupId: data.data.id
					},
					success: function(_data) {
						callback && callback(_data, status);
					}
				});
			}
		},

		groupsRequestUserList: function(args) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: _.merge({
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		groupsRequestDeviceList: function(args, applyFilter) {
			var self = this;

			var deviceFilters = {
				paginate: false
			};

			// get phone only devices
			if (miscSettings.filterRingGroupLists && applyFilter) {
				deviceFilters['filter_dimension.type'] = 'communal';
			}

			// get all other devices with filters
			if (miscSettings.filterRingGroupLists && !applyFilter) {
				var dimensionsDeviceType = [],
					deviceType = [];

				dimensionsDeviceType.push('communal');
				dimensionsDeviceType.push('legacypbx');
				dimensionsDeviceType.push('hotdesk');

				if (miscSettings.filterRingGroupListsRemoveLandline) {
					deviceType.push('landline');
				}
				if (miscSettings.filterRingGroupListsRemoveCellphone) {
					deviceType.push('cellphone');
				}
				if (miscSettings.filterRingGroupListsRemoveFax) {
					deviceType.push('fax');
				}
				
				if (dimensionsDeviceType.length > 0) {
					deviceFilters['filter_not_dimension.type'] = dimensionsDeviceType;
				}
				
				if (deviceType.length > 0) {
					deviceFilters['filter_not_device_type'] = deviceType;
				}
			}
			
			self.callApi({
				resource: 'device.list',
				data: _.merge({
					accountId: self.accountId,
					filters: deviceFilters
				}, args.data),
				success: function(data, status) {
					data.data.sort((a, b) => a.name.localeCompare(b.name));
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		groupsSubmoduleButtons: function(data) {
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
						hideDelete: hideAdd.groups
					}
				}));
			
			$('.entity-header-buttons').empty();
			$('.entity-header-buttons').append(buttons);

			if (!data.id) {
				$('.delete', '.entity-header-buttons').addClass('disabled');
			}
		},

		groupsRenderTable: function(groups_html) {
			$('#tab_users > .rows .row', groups_html).each(function(index, element) {
				$(element).removeClass('row-odd row-even');
				if (index % 2 === 0) {
					$(element).addClass('row-even');
				} else {
					$(element).addClass('row-odd');
				}
			})
		}

	};

	return app;
});
