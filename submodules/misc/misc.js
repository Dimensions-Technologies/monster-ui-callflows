define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		miscSettings = {},
		ttsLanguages = {},
		callTags = [],
		contactDirectories = [];

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'miscDefineActions'
		},

		appFlags: {
			misc: {
				webhook: {
					verbsWithFormat: ['post', 'put'],
					bodyFormats: ['form-data', 'json'],
					httpVerbs: {
						get: 'GET',
						post: 'POST',
						put: 'PUT'
					}
				}
			}
		},

		miscGetGroupPickupData: function(callback) {
			var self = this;

			monster.parallel({
				groups: function(callback) {
					self.miscGroupList(function(data) {
						callback(null, data);
					});
				},
				users: function(callback) {
					self.miscUserList(function(data) {
						_.each(data, function(user) {
							user.name = user.first_name + ' ' + user.last_name;
						});
						callback(null, data);
					});
				},
				devices: function(callback) {
					self.miscDeviceList(function(data) {
						callback(null, data);
					});
				}
			}, function(err, results) {
				callback && callback(results);
			});
		},

		miscDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				hideCallflowAction = args.hideCallflowAction;

			// set variables for use elsewhere
			miscSettings = args.miscSettings,
			ttsLanguages = args.ttsLanguages,
			callTags = args.callTags,
			contactDirectories = args.contactDirectories && args.contactDirectories.length > 0 ? args.contactDirectories.filter(function(directory) {
				return directory.name !== 'User Contact Directory';
			}): [];
			
			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				// custom callflow actions
				var customActions = [
					'userCallflow[id=*]',
					'phoneOnlyCallflow[id=*]',
					'callCentreCallflow[id=*]',
					'legacyPbxCallflow[id=*]',
					'group_pickupUser[user_id=*]',
					'group_pickupDevice[device_id=*]',
					'group_pickupGroup[group_id=*]',
					'dimensionsCallTag[id=*]',
					'dimensionsDirectoryRouting[id=*]'
				];

				// if custom callflow actions are disabled
				if (!miscSettings.enableCustomCallflowActions) {
					if (customActions.includes(key)) {
						return false;
					} else {
						return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
					}
				} else {
					return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
				}
			};

			var actions = {
				'root': {
					name: 'Root',
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'false'
				},
				'callflow[id=*]': {
					name: self.i18n.active().oldCallflows.callflow,
					icon: 'callflow',
					google_icon: 'alt_route',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'callflow',
					tip: self.i18n.active().oldCallflows.callflow_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: true,
					weight: 80,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
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

						var callflowFilters = {
							paginate: false,
							filter_not_numbers: 'no_match',
							filter_not_name: 'Dimensions_ReservedFeatureCodes'
						};

						var hideDimensionDeviceCallflow = [],
							hideCallCentreCallflow = [];

						// are custom callflow actions are enabled
						if (miscSettings.enableCustomCallflowActions) {
							if (miscSettings.callflowActionHideSmartPbxCallflows) {
								callflowFilters['filter_not_type'] = 'mainUserCallflow';
							}
							if (miscSettings.callflowActionHideOriginVoip) {
								callflowFilters['filter_not_ui_metadata.origin'] = 'voip';
							}
							if (miscSettings.callflowActionHideQubicleCallflows) {
								hideCallCentreCallflow.push('qubicle');
							}
							if (miscSettings.callflowActionHideAcdcCallflows) {
								hideCallCentreCallflow.push('acdc_member');
							}
							if (hideCallCentreCallflow.length > 0) {
								callflowFilters['filter_not_flow.module'] = hideCallCentreCallflow;
							}
							if (miscSettings.callflowActionHidePhoneOnlyCallflows) {
								hideDimensionDeviceCallflow.push('communal');
							}
							if (miscSettings.callflowActionHideLegacyPbxCallflows) {
								hideDimensionDeviceCallflow.push('legacypbx');
							}
							if (hideDimensionDeviceCallflow.length > 0) {
								callflowFilters['filter_not_dimension.type'] = hideDimensionDeviceCallflow;
							}
						}

						self.callApi({

							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: callflowFilters
							},
							success: function(data, status) {
								var popup, popup_html, _data = [];

								$.each(data.data, function() {
									if (!this.featurecode && this.id !== self.flow.id) {
										this.name = this.name ? this.name : ((this.numbers) ? this.numbers.toString() : self.i18n.active().oldCallflows.no_numbers);

										_data.push(this);
									}
								});

								var selectedId = node.getMetadata('id') || '',
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
										name: 'callflow-edit_dialog',
										data: {
											objects: {
												type: 'callflow',
												items: _.sortBy(_data, 'name'),
												selected: node.getMetadata('id') || ''
											}
										},
										submodule: 'misc'
									}));

									var selector = popup_html.find('#object-selector');

									if (itemNotFound) {
										selector.attr("data-placeholder", "Configured Destination Not Found").addClass("item-not-found").trigger("chosen:updated");
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
										node.setMetadata('id', $('#object-selector', popup_html).val());

										node.caption = $('#object-selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().oldCallflows.callflow_title,
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
				'userCallflow[id=*]': {
					name: self.i18n.active().callflows.userCallflow.callflow,
					icon: 'user',
					google_icon: 'person',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'callflow',
					tip: self.i18n.active().callflows.userCallflow.callflow_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('userCallflow[id=*]'),
					weight: 81,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
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
									paginate: false,
									filter_not_numbers: 'no_match',
									filter_type: 'mainUserCallflow'
								}
							},
							success: function(data, status) {
								var popup, popup_html, _data = [];

								$.each(data.data, function() {
									if (!this.featurecode && this.id !== self.flow.id) {
										// remove 'SmartPBX's Callflow' from this.name if it exists
										if (this.name) {
											this.name = this.name.replace("SmartPBX's Callflow", '');
										} else {
											this.name = this.numbers ? this.numbers.toString() : self.i18n.active().oldCallflows.no_numbers;
										}
								
										_data.push(this);
									}
								});

								var selectedId = node.getMetadata('id') || '',
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
										name: 'callflowUser-edit_dialog',
										data: {
											objects: {
												type: 'callflow',
												items: _.sortBy(_data, 'name'),
												selected: node.getMetadata('id') || ''
											}
										},
										submodule: 'misc'
									}));

									var selector = popup_html.find('#object-selector');

									if (itemNotFound) {
										selector.attr("data-placeholder", "Configured Destination Not Found").addClass("item-not-found").trigger("chosen:updated");
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
										node.setMetadata('id', $('#object-selector', popup_html).val());

										node.caption = $('#object-selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().callflows.userCallflow.title,
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
				'phoneOnlyCallflow[id=*]': {
					name: self.i18n.active().callflows.phoneOnlyCallflow.callflow,
					icon: 'phone',
					google_icon: 'deskphone',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'callflow',
					tip: self.i18n.active().callflows.phoneOnlyCallflow.callflow_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('phoneOnlyCallflow[id=*]'),
					weight: 83,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
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
									paginate: false,
									filter_not_numbers: 'no_match',
									'filter_dimension.type': 'communal'
								}
							},
							success: function(data, status) {
								var popup, popup_html, _data = [];

								$.each(data.data, function() {
									if (!this.featurecode && this.id !== self.flow.id) {
										this.name = this.name ? this.name : ((this.numbers) ? this.numbers.toString() : self.i18n.active().oldCallflows.no_numbers);

										_data.push(this);
									}
								});

								var selectedId = node.getMetadata('id') || '',
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
										name: 'callflowPhoneOnly-edit_dialog',
										data: {
											objects: {
												type: 'callflow',
												items: _.sortBy(_data, 'name'),
												selected: node.getMetadata('id') || ''
											}
										},
										submodule: 'misc'
									}));

									var selector = popup_html.find('#object-selector');

									if (itemNotFound) {
										selector.attr("data-placeholder", "Configured Destination Not Found").addClass("item-not-found").trigger("chosen:updated");
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
										node.setMetadata('id', $('#object-selector', popup_html).val());

										node.caption = $('#object-selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().callflows.phoneOnlyCallflow.title,
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
				'callCentreCallflow[id=*]': {
					name: self.i18n.active().callflows.callCentreCallflow.callflow,
					icon: 'support',
					google_icon: 'support_agent',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'callflow',
					tip: self.i18n.active().callflows.callCentreCallflow.callflow_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('callCentreCallflow[id=*]'),
					weight: 82,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
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

						var callflowFilters = {
							paginate: false,
							filter_not_numbers: 'no_match'
						};

						var callCentreCallflow = [];

						if (!miscSettings.callCentreActionHideQubicle) {
							callCentreCallflow.push('qubicle');
						}
						if (miscSettings.callCentreActionShowAcdc) {
							callCentreCallflow.push('acdc_member');
						}
						if (callCentreCallflow.length > 0) {
							callflowFilters['filter_flow.module'] = callCentreCallflow;
						}
							
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: callflowFilters
							},
							success: function(data, status) {
								var popup, popup_html, _data = [];

								$.each(data.data, function() {
									if (!this.featurecode && this.id !== self.flow.id) {
										// remove 'Qubicle Callflow' from this.name if it exists
										if (this.name) {
											this.name = this.name.replace("Qubicle Callflow", '');
										} else {
											this.name = this.numbers ? this.numbers.toString() : self.i18n.active().oldCallflows.no_numbers;
										}

										_data.push(this);
									}
								});

								var selectedId = node.getMetadata('id') || '',
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
										name: 'callflowQubicle-edit_dialog',
										data: {
											objects: {
												type: 'callflow',
												items: _.sortBy(_data, 'name'),
												selected: node.getMetadata('id') || ''
											}
										},
										submodule: 'misc'
									}));

									var selector = popup_html.find('#object-selector');

									if (itemNotFound) {
										selector.attr("data-placeholder", "Configured Destination Not Found").addClass("item-not-found").trigger("chosen:updated");
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
										node.setMetadata('id', $('#object-selector', popup_html).val());

										node.caption = $('#object-selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().callflows.callCentreCallflow.title,
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
				'legacyPbxCallflow[id=*]': {
					name: self.i18n.active().callflows.legacyPbxCallflow.callflow,
					icon: 'phone',
					google_icon: 'hard_drive',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'callflow',
					tip: self.i18n.active().callflows.legacyPbxCallflow.callflow_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('legacyPbxCallflow[id=*]'),
					weight: 80,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
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
									paginate: false,
									filter_not_numbers: 'no_match',
									'filter_dimension.type': 'legacypbx'
								}
							},
							success: function(data, status) {
								var popup, popup_html, _data = [];

								$.each(data.data, function() {
									if (!this.featurecode && this.id !== self.flow.id) {
										this.name = this.name ? this.name : ((this.numbers) ? this.numbers.toString() : self.i18n.active().oldCallflows.no_numbers);

										_data.push(this);
									}
								});

								var selectedId = node.getMetadata('id') || '',
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
										name: 'callflowLegacyPbx-edit_dialog',
										data: {
											objects: {
												type: 'callflow',
												items: _.sortBy(_data, 'name'),
												selected: node.getMetadata('id') || ''
											}
										},
										submodule: 'misc'
									}));

									var selector = popup_html.find('#object-selector');

									if (itemNotFound) {
										selector.attr("data-placeholder", "Configured Destination Not Found").addClass("item-not-found").trigger("chosen:updated");
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
										node.setMetadata('id', $('#object-selector', popup_html).val());

										node.caption = $('#object-selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().callflows.legacyPbxCallflow.title,
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
				'do_not_disturb[action=activate]': {
					name: self.i18n.active().callflows.doNotDisturb.activate.label,
					icon: 'x_circle',
					google_icon: 'do_not_disturb_on',
					category: self.i18n.active().callflows.doNotDisturb.categoryName,
					module: 'do_not_disturb',
					tip: self.i18n.active().callflows.doNotDisturb.activate.tip,
					data: {
						action: 'activate'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('do_not_disturb[action=activate]'),
					weight: 1,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'do_not_disturb[action=deactivate]': {
					name: self.i18n.active().callflows.doNotDisturb.deactivate.label,
					icon: 'x_circle',
					google_icon: 'do_not_disturb_off',
					category: self.i18n.active().callflows.doNotDisturb.categoryName,
					module: 'do_not_disturb',
					tip: self.i18n.active().callflows.doNotDisturb.deactivate.tip,
					data: {
						action: 'deactivate'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('do_not_disturb[action=deactivate]'),
					weight: 2,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'do_not_disturb[action=toggle]': {
					name: self.i18n.active().callflows.doNotDisturb.toggle.label,
					icon: 'x_circle',
					google_icon: 'restart_alt',
					category: self.i18n.active().callflows.doNotDisturb.categoryName,
					module: 'do_not_disturb',
					tip: self.i18n.active().callflows.doNotDisturb.toggle.tip,
					data: {
						action: 'toggle'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('do_not_disturb[action=toggle]'),
					weight: 3,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'call_forward[action=activate]': {
					name: self.i18n.active().oldCallflows.enable_call_forwarding,
					icon: 'rightarrow',
					google_icon: 'phone_forwarded',
					category: self.i18n.active().oldCallflows.call_forwarding_cat,
					module: 'call_forward',
					tip: self.i18n.active().oldCallflows.enable_call_forwarding_tip,
					data: {
						action: 'activate'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('call_forward[action=activate]'),
					weight: 10,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'call_forward[action=deactivate]': {
					name: self.i18n.active().oldCallflows.disable_call_forwarding,
					icon: 'rightarrow',
					google_icon: 'phone_paused',
					category: self.i18n.active().oldCallflows.call_forwarding_cat,
					module: 'call_forward',
					tip: self.i18n.active().oldCallflows.disable_call_forwarding_tip,
					data: {
						action: 'deactivate'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('call_forward[action=deactivate]'),
					weight: 20,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'call_forward[action=update]': {
					name: self.i18n.active().oldCallflows.update_call_forwarding,
					icon: 'rightarrow',
					google_icon: 'phone_forwarded',
					category: self.i18n.active().oldCallflows.call_forwarding_cat,
					module: 'call_forward',
					tip: self.i18n.active().oldCallflows.update_call_forwarding_tip,
					data: {
						action: 'update'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('call_forward[action=update]'),
					weight: 30,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'dynamic_cid[]': {
					name: self.i18n.active().oldCallflows.dynamic_cid,
					icon: 'rightarrow',
					google_icon: 'playlist_add_check_circle',
					category: self.i18n.active().oldCallflows.caller_id_cat,
					module: 'dynamic_cid',
					tip: self.i18n.active().oldCallflows.dynamic_cid_tip,
					isUsable: 'true',
					isListed: determineIsListed('dynamic_cid[]'),
					weight: 10,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'prepend_cid[action=prepend]': {
					name: self.i18n.active().oldCallflows.prepend,
					icon: 'plus_circle',
					google_icon: 'add_circle',
					category: self.i18n.active().oldCallflows.caller_id_cat,
					module: 'prepend_cid',
					tip: self.i18n.active().oldCallflows.prepend_tip,
					data: {
						action: 'prepend',
						caller_id_name_prefix: '',
						caller_id_number_prefix: '',
						apply_to: 'original'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('prepend_cid[action=prepend]'),
					weight: 20,
					caption: function(node) {
						return (node.getMetadata('caller_id_name_prefix') || '') + ' ' + (node.getMetadata('caller_id_number_prefix') || '');
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'prepend_cid_callflow',
							data: {
								data_cid: {
									'caller_id_name_prefix': node.getMetadata('caller_id_name_prefix') || '',
									'caller_id_number_prefix': node.getMetadata('caller_id_number_prefix') || '',
									'apply_to': node.getMetadata('apply_to') || ''
								}
							},
							submodule: 'misc'
						}));

						// enable or disable the save button if name and number are empty
						function toggleSaveButton() {
							var cidName = $('#cid_name_prefix', popup_html).val(),
								cidNumber = $('#cid_number_prefix', popup_html).val();
							
							if (cidName == '' && cidNumber == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#cid_name_prefix', popup_html).change(toggleSaveButton);
						$('#cid_number_prefix', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var cid_name_val = $('#cid_name_prefix', popup_html).val(),
								cid_number_val = $('#cid_number_prefix', popup_html).val(),
								apply_to_val = $('#apply_to', popup_html).val();

							// ensure there's a space at the end of `cid_name_prefix` for better formatting
							if (cid_name_val !== '' && !cid_name_val.endsWith(' ')) {
								cid_name_val += ' ';
							}

							node.setMetadata('caller_id_name_prefix', cid_name_val);
							node.setMetadata('caller_id_number_prefix', cid_number_val);
							node.setMetadata('apply_to', apply_to_val);

							node.caption = cid_name_val + ' ' + cid_number_val;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.prepend_caller_id_title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});

						monster.ui.tooltips(popup);

						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'prepend_cid[action=reset]': {
					name: self.i18n.active().oldCallflows.reset_prepend,
					icon: 'loop2',
					google_icon: 'change_circle',
					category: self.i18n.active().oldCallflows.caller_id_cat,
					module: 'prepend_cid',
					tip: self.i18n.active().oldCallflows.reset_prepend_tip,
					data: {
						action: 'reset'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('prepend_cid[action=reset]'),
					weight: 30,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'set_alert_info[]': {
					name: self.i18n.active().callflows.setAlertInfo.name,
					icon: 'play',
					google_icon: 'notifications_active',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'set_alert_info',
					tip: self.i18n.active().callflows.setAlertInfo.tip,
					data: {
						alert_info: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('set_alert_info[]'),
					weight: 20,

					caption: function(node) {
						return (node.getMetadata('alert_info') || '');
					},

					edit: function(node, callback) {
						var popup_html = $(self.getTemplate({
								name: 'setAlertEdit',
								data: {
									alert_info: node.getMetadata('alert_info') || ''
								},
								submodule: 'misc'
							})),
							popup;

						// enable or disable the save button based input value
						function toggleSaveButton() {
							var inputValue = $('#alert_info', popup_html).val();
							
							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#alert_info', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var alert_info_val = $('#alert_info', popup_html).val();

							node.setMetadata('alert_info', alert_info_val);

							node.caption = alert_info_val;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.setAlertInfo.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'manual_presence[]': {
					name: self.i18n.active().oldCallflows.manual_presence,
					icon: 'lightbulb_on',
					google_icon: 'online_prediction',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'manual_presence',
					tip: self.i18n.active().oldCallflows.manual_presence_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('manual_presence[]'),
					weight: 40,
					caption: function(node) {
						return node.getMetadata('presence_id') || '';
					},
					edit: function(node, callback) {
						var popup_html = $(self.getTemplate({
								name: 'presence-callflowEdit',
								data: {
									data_presence: {
										'presence_id': node.getMetadata('presence_id') || '',
										'status': node.getMetadata('status') || 'busy'
									}
								},
								submodule: 'misc'
							})),
							popup;

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#presence_id_input', popup_html).val();
							
							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#presence_id_input', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var presence_id = $('#presence_id_input', popup_html).val();
							node.setMetadata('presence_id', presence_id);
							node.setMetadata('status', $('#presence_status option:selected', popup_html).val());

							node.caption = presence_id;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.manual_presence_title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'language[]': {
					name: self.i18n.active().oldCallflows.language,
					icon: 'earth',
					google_icon: 'language',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'language',
					tip: self.i18n.active().oldCallflows.language_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('language[]'),
					weight: 50,
					caption: function(node) {
						return node.getMetadata('language') || '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'language',
							data: {
								data_language: {
									'language': node.getMetadata('language') || ''
								}
							},
							submodule: 'misc'
						}));

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#language_id_input', popup_html).val();
							
							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#language_id_input', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var language = $('#language_id_input', popup_html).val();
							node.setMetadata('language', language);
							node.caption = language;

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.language_title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'group_pickup[]': {
					name: self.i18n.active().oldCallflows.group_pickup,
					icon: 'sip',
					google_icon: 'step_out',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'group_pickup',
					tip: self.i18n.active().oldCallflows.group_pickup_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('group_pickup[]'),
					weight: 60,
					caption: function(node) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {
						self.miscGetGroupPickupData(function(results) {
							var popup, popup_html;

							var selectedId = node.getMetadata('device_id') || node.getMetadata('group_id') || node.getMetadata('user_id') || '',
								selectedItem = _.find(results.users, { id: selectedId }) || 
											_.find(results.groups, { id: selectedId }) || 
											_.find(results.devices, { id: selectedId });

							var pickupType,
								pickupList;

							if (node.getMetadata('device_id')) {
								pickupType = 'device';
								pickupList = results.devices;
							} else if (node.getMetadata('group_id')) {
								pickupType = 'group';
								pickupList = results.groups;
							} else if (node.getMetadata('user_id')) {
								pickupType = 'user';
								pickupList = results.users;
							}

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: pickupList,
									resource: pickupType,
									resourceId: pickupType+'Id',
									callback: function(itemNotFound) {
										renderPopup(itemNotFound, pickupType);
									}
								});
							} else {
								renderPopup(false);
							}

							function renderPopup(itemNotFound, pickupType) {
								popup_html = $(self.getTemplate({
									name: 'group_pickup',
									data: {
										data: {
											items: results,
											selected: node.getMetadata('device_id') || node.getMetadata('group_id') || node.getMetadata('user_id') || ''
										}
									},
									submodule: 'misc'
								}));

								var selector = popup_html.find('#endpoint_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured " + pickupType.charAt(0).toUpperCase() + pickupType.slice(1) + " Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#endpoint_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#endpoint_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
									} else {
										$('#add', popup_html).prop('disabled', false);
									}
								}

								toggleSaveButton();

								$('#endpoint_selector', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									var selector = $('#endpoint_selector', popup_html),
										id = selector.val(),
										name = selector.find('#' + id).html(),
										type = $('#' + id, popup_html).parents('optgroup').data('type'),
										type_id = type.substring(type, type.length - 1) + '_id';

									/* Clear all the useless attributes */
									node.data.data = {};
									node.setMetadata(type_id, id);
									node.setMetadata('name', name);

									node.caption = name;

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.group_pickup_title,
									beforeClose: function() {
										callback && callback();
									}
								});
							}
						});
					}
				},
				'group_pickupUser[user_id=*]': {
					name: self.i18n.active().oldCallflows.user_pickup,
					icon: 'sip',
					google_icon: 'step_out',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'group_pickup',
					tip: self.i18n.active().oldCallflows.user_pickup_tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: true,
					isUsable: true,
					isListed: determineIsListed('group_pickupUser[user_id=*]'),
					weight: 61,
					caption: function(node) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {

						function fetchUsers(callback) {
							self.miscUserList(function(data) {
								_.each(data, function(user) {
									user.name = user.first_name + ' ' + user.last_name;
								});
								callback({ users: data });
							});
						}

						fetchUsers(function(results) {
							var popup, popup_html;

							var selectedId = node.getMetadata('user_id') || '',
								selectedItem = _.find(results.users, { id: selectedId });
	
							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: results.users,
									resource: 'user',
									resourceId: 'userId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}

							function renderPopup(itemNotFound) {
								popup_html = $(self.getTemplate({
									name: 'group_pickupUser',
									data: {
										data: {
											items: results,
											selected: node.getMetadata('user_id') || ''
										}
									},
									submodule: 'misc'
								}));

								var selector = popup_html.find('#endpoint_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured User Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#endpoint_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#endpoint_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
									} else {
										$('#add', popup_html).prop('disabled', false);
									}
								}

								toggleSaveButton();

								$('#endpoint_selector', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									var selector = $('#endpoint_selector', popup_html),
										id = selector.val(),
										name = selector.find('#' + id).html(),
										type = 'users',
										type_id = type.substring(type, type.length - 1) + '_id';

									/* Clear all the useless attributes */
									node.data.data = {};
									node.setMetadata(type_id, id);
									node.setMetadata('name', name);

									node.caption = name;

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.user_pickup_title,
									beforeClose: function() {
										callback && callback();
									}
								});
							}
						});
					}
				},
				'group_pickupGroup[group_id=*]': {
					name: self.i18n.active().oldCallflows.group_pickup,
					icon: 'sip',
					google_icon: 'step_out',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'group_pickup',
					tip: self.i18n.active().oldCallflows.group_pickup_tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: true,
					isUsable: true,
					isListed: determineIsListed('group_pickupGroup[group_id=*]'),
					weight: 62,
					caption: function(node) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {

						function fetchGroups(callback) {
							self.callApi({
								resource: 'group.list',
								data: {
									accountId: self.accountId,
									filters: {
										paginate: false,
										'filter_not_group_type': 'personal'
									}
								},
								success: function(data, status) {
									// sort groups alphabetically by name
									var sortedGroups = data.data.sort((a, b) => a.name.localeCompare(b.name));
									callback({ groups: sortedGroups });
								}
							});
						}

						fetchGroups(function(results) {

							var popup, popup_html;

							var selectedId = node.getMetadata('group_id') || '',
								selectedItem = _.find(results.groups, { id: selectedId });
	
							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: results.groups,
									resource: 'group',
									resourceId: 'groupId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}
							
							function renderPopup(itemNotFound) {
								popup_html = $(self.getTemplate({
									name: 'group_pickupGroup',
									data: {
										data: {
											items: results,
											selected: node.getMetadata('group_id') || ''
										}
									},
									submodule: 'misc'
								}));

								var selector = popup_html.find('#endpoint_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Group Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#endpoint_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#endpoint_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
									} else {
										$('#add', popup_html).prop('disabled', false);
									}
								}

								toggleSaveButton();

								$('#endpoint_selector', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									var selector = $('#endpoint_selector', popup_html),
										id = selector.val(),
										name = selector.find('#' + id).html(),
										type = 'groups',
										type_id = type.substring(type, type.length - 1) + '_id';

									/* Clear all the useless attributes */
									node.data.data = {};
									node.setMetadata(type_id, id);
									node.setMetadata('name', name);

									node.caption = name;

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.group_pickup_title,
									beforeClose: function() {
										callback && callback();
									}
								});
							}
						});
					}
				},
				'group_pickupDevice[device_id=*]': {
					name: self.i18n.active().oldCallflows.device_pickup,
					icon: 'sip',
					google_icon: 'step_out',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'group_pickup',
					tip: self.i18n.active().oldCallflows.device_pickup_tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: true,
					isUsable: true,
					isListed: determineIsListed('group_pickupDevice[device_id=*]'),
					weight: 63,
					caption: function(node) {
						return node.getMetadata('name') || '';
					},
					edit: function(node, callback) {

						function fetchDevices(callback) {
							self.callApi({
								resource: 'device.list',
								data: {
									accountId: self.accountId,
									filters: {
										paginate: false,
										'filter_not_dimension.type': 'legacypbx'
									}
								},
								success: function(data, status) {
									// sort devices alphabetically by name
									var sortedDevices = data.data.sort((a, b) => a.name.localeCompare(b.name));
									callback({ devices: sortedDevices });
								}
							});
						}

						fetchDevices(function(results) {

							var popup, popup_html;

							var selectedId = node.getMetadata('device_id') || '',
								selectedItem = _.find(results.devices, { id: selectedId });
	
							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: results.devices,
									resource: 'device',
									resourceId: 'deviceId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}

							function renderPopup(itemNotFound) {
								popup_html = $(self.getTemplate({
									name: 'group_pickupDevice',
									data: {
										data: {
											items: results,
											selected: node.getMetadata('device_id') || ''
										}
									},
									submodule: 'misc'
								}));

								var selector = popup_html.find('#endpoint_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#endpoint_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#endpoint_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
									} else {
										$('#add', popup_html).prop('disabled', false);
									}
								}

								toggleSaveButton();

								$('#endpoint_selector', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									var selector = $('#endpoint_selector', popup_html),
										id = selector.val(),
										name = selector.find('#' + id).html(),
										type = 'devices',
										type_id = type.substring(type, type.length - 1) + '_id';

									/* Clear all the useless attributes */
									node.data.data = {};
									node.setMetadata(type_id, id);
									node.setMetadata('name', name);

									node.caption = name;

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.device_pickup_title,
									beforeClose: function() {
										callback && callback();
									}
								});
							}
						});
					}
				},
				'receive_fax[]': {
					name: self.i18n.active().oldCallflows.receive_fax,
					icon: 'sip',
					google_icon: 'fax',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'receive_fax',
					tip: self.i18n.active().oldCallflows.receive_fax_tip,
					data: {
						owner_id: null
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('receive_fax[]'),
					weight: 70,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						self.miscUserList(function(data, status) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(data, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: data,
									resource: 'user',
									resourceId: 'userId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}

							function renderPopup(itemNotFound) {
								$.each(data, function() {
									this.name = this.first_name + ' ' + this.last_name;
								});

								popup_html = $(self.getTemplate({
									name: 'fax-callflowEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										objects: {
											items: data,
											selected: node.getMetadata('owner_id') || '',
											t_38: node.getMetadata('media') && (node.getMetadata('media').fax_option || false)
										}
									},
									submodule: 'misc'
								}));

								if ($('#user_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#user_selector', popup_html).val() } : {};

									ev.preventDefault();

									monster.pub('callflows.user.popupEdit', {
										data: _data,
										callback: function(_data) {
											node.setMetadata('owner_id', _data.id || 'null');

											popup.dialog('close');
										}
									});
								});

								var selector = popup_html.find('#queue_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured User Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#user_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#user_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#user_selector', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									node.setMetadata('owner_id', $('#user_selector', popup_html).val());
									node.setMetadata('media', {
										fax_option: $('#t_38_checkbox', popup_html).is(':checked')
									});
									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.receive_fax,
									minHeight: '0',
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						});
					}
				},
				'record_call[action=start]': {
					name: self.i18n.active().oldCallflows.start_call_recording,
					icon: 'conference',
					google_icon: 'volume_up',
					category: self.i18n.active().oldCallflows.call_recording_cat,
					module: 'record_call',
					tip: self.i18n.active().oldCallflows.start_call_recording_tip,
					data: {
						action: 'start'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('record_call[action=start]'),
					weight: 10,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (miscSettings.hideStartCallRecordingSettings) {
							node.setMetadata('format', 'mp3');
							node.setMetadata('time_limit', 10800);
							if (typeof callback === 'function') {
								callback();
							}
						} else {
							var popup_html = $(self.getTemplate({
								name: 'recordCall-callflowEdit',
								data: {
									data_call_record: {
										'format': node.getMetadata('format') || 'mp3',
										'url': node.getMetadata('url') || '',
										'time_limit': node.getMetadata('time_limit') || '600'
									}
								},
								submodule: 'misc'
							})),
							popup;

							$('#add', popup_html).click(function() {
								var callRecordUrl = $('#url', popup_html).val();
								if (callRecordUrl.trim() !== '') {
									node.setMetadata('url', callRecordUrl);
								} else {
									node.deleteMetadata('url');
								}
								node.setMetadata('format', $('#format', popup_html).val());
								node.setMetadata('time_limit', $('#time_limit', popup_html).val());

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().oldCallflows.start_call_recording,
								minHeight: '0',
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						}
					}
				},
				'record_call[action=stop]': {
					name: self.i18n.active().oldCallflows.stop_call_recording,
					icon: 'conference',
					google_icon: 'volume_off',
					category: self.i18n.active().oldCallflows.call_recording_cat,
					module: 'record_call',
					tip: self.i18n.active().oldCallflows.stop_call_recording_tip,
					data: {
						action: 'stop'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('record_call[action=stop]'),
					weight: 20,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'pivot[]': {
					name: self.i18n.active().oldCallflows.pivot,
					icon: 'conference',
					google_icon: 'cloud_upload',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'pivot',
					tip: self.i18n.active().oldCallflows.pivot_tip,
					data: {
						method: 'POST',
						req_timeout: '5',
						req_format: 'kazoo',
						voice_url: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						},
						{
							type: 'allowedChildren',
							action: [
								'callflow[id=*]'
							]
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('pivot[]'),
					weight: 80,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'pivot',
							data: {
								miscSettings: miscSettings,
								data_pivot: {
									'method': node.getMetadata('method') || 'post',
									'voice_url': node.getMetadata('voice_url') || '',
									'req_timeout': node.getMetadata('req_timeout') || '5',
									'req_format': node.getMetadata('req_format') || 'kazoo'
								}
							},
							submodule: 'misc'
						}));

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#pivot_voiceurl_input', popup_html).val();
							
							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else if (!(inputValue.startsWith('http://') || inputValue.startsWith('https://'))) {
								$('#add', popup_html).prop('disabled', true);
								monster.ui.alert('warning', self.i18n.active().oldCallflows.pivot_url_invalid);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#pivot_voiceurl_input', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var requestFormat;
							
							if ($('#pivot_format_input', popup_html).length) {
								requestFormat = $('#pivot_format_input', popup_html).val();
							} else {
								var metadataFormat = node.getMetadata('req_format');
								requestFormat = metadataFormat ? metadataFormat : 'kazoo';
							}

							node.setMetadata('voice_url', $('#pivot_voiceurl_input', popup_html).val());
							node.setMetadata('method', $('#pivot_method_input', popup_html).val());
							node.setMetadata('req_format', requestFormat);
							node.setMetadata('req_timeout', $('#pivot_timeout_input', popup_html).val());

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().oldCallflows.pivot_title,
							minHeight: '0',
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});

						// alert for invalid request timeout value
						$('#pivot_timeout_input', popup_html).change(function() {
							requestTimeout = $('#pivot_timeout_input', popup_html).val();
							if (requestTimeout < 5 || requestTimeout > 20) {
								$('#pivot_timeout_input', popup_html).val(5);
								monster.ui.alert('warning', self.i18n.active().oldCallflows.pivot_timeout_invalid);
							}
						});

					}
				},
				'disa[]': {
					name: self.i18n.active().oldCallflows.disa,
					icon: 'conference',
					google_icon: 'login',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'disa',
					tip: self.i18n.active().oldCallflows.disa_tip,
					data: {
						pin: '',
						use_account_caller_id: true
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('disa[]'),
					weight: 90,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'disa',
							data: {
								miscSettings: miscSettings,
								data_disa: {
									'pin': node.getMetadata('pin'),
									'retries': node.getMetadata('retries') || '2',
									'interdigit': node.getMetadata('interdigit') 
										? (node.getMetadata('interdigit') / 1000).toString() 
										: '5',
									'max_digits': node.getMetadata('max_digits') || '4',
									'preconnect_audio': node.getMetadata('preconnect_audio'),
									'use_account_caller_id': node.getMetadata('use_account_caller_id')
								}
							},
							submodule: 'misc'
						}));

						//monster.ui.tooltips(popup_html);


						if (miscSettings.disaActionEnforcePin) {
							// enable or disable the save button based on the input value
							function toggleSaveButton() {
								var inputValue = $('#disa_pin_input', popup_html).val();
								
								if (inputValue == '') {
									$('#add', popup_html).prop('disabled', true);
								} else if (inputValue.length > 0 && inputValue.length < 4) {
									monster.ui.alert('warning', self.i18n.active().callflows.disa.pin.invalid);
									$('#add', popup_html).prop('disabled', true);
								} else {
									$('#add', popup_html).prop('disabled', false);
								}
							}

							toggleSaveButton();

							$('#disa_pin_input', popup_html).change(toggleSaveButton);
						}
						
						$('#add', popup_html).click(function() {
							var save_disa = function() {
								var setData = function(field, value) {
									if (value !== 'default') {
										node.setMetadata(field, value);
									} else {
										node.deleteMetadata(field);
									}
								};

								// convert interdigit timeout value to milliseconds
								let interdigitTimeoutSeconds = $('#disa_interdigit_input', popup_html).val();
								let interdigitTimeoutMilliseconds = interdigitTimeoutSeconds * 1000;

								setData('pin', $('#disa_pin_input', popup_html).val());
								setData('retries', $('#disa_retries_input', popup_html).val());
								setData('interdigit', interdigitTimeoutMilliseconds);
								setData('preconnect_audio', $('#preconnect_audio', popup_html).val());
								setData('use_account_caller_id', !$('#disa_keep_original_caller_id', popup_html).is(':checked'));
								setData('max_digits', $('#disa_max_digits_input', popup_html).val());

								popup.dialog('close');
							};
							if ($('#disa_pin_input', popup_html).val() === '') {
								monster.ui.confirm(self.i18n.active().oldCallflows.not_setting_a_pin, function() {
									save_disa();
								});
							} else {
								save_disa();
							}
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.disa.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});

						// alert for invalid retries value
						$('#disa_retries_input', popup_html).change(function() {
							inputValue = $('#disa_retries_input', popup_html).val();
							if (inputValue < 0 || inputValue > 10) {
								$('#disa_retries_input', popup_html).val(2);
								monster.ui.alert('warning', self.i18n.active().callflows.disa.retries.invalid);
							}
						});

						// alert for invalid interdigit timeout value
						$('#disa_interdigit_input', popup_html).change(function() {
							inputValue = $('#disa_interdigit_input', popup_html).val();
							if (inputValue < 5 || inputValue > 20) {
								$('#disa_interdigit_input', popup_html).val(5);
								monster.ui.alert('warning', self.i18n.active().callflows.disa.interdigit.invalid);
							}
						});

						// alert for invalid max digits value
						$('#disa_max_digits_input', popup_html).change(function() {
							inputValue = $('#disa_max_digits_input', popup_html).val();
							if (inputValue < 4 || inputValue > 20) {
								$('#disa_max_digits_input', popup_html).val(4);
								monster.ui.alert('warning', self.i18n.active().callflows.disa.max_digits.invalid);
							}
						});

					}
				},
				'collect_dtmf[]': {
					name: self.i18n.active().callflows.collectDTMF.title,
					icon: 'conference',
					google_icon: 'pin',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'collect_dtmf',
					tip: self.i18n.active().callflows.collectDTMF.tip,
					data: {
						pin: '',
						use_account_caller_id: true
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('collect_dtmf[]'),
					weight: 90,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'collect-dtmf',
							data: {
								data_dtmf: {
									interdigit_timeout: node.getMetadata('interdigit_timeout') 
										? (node.getMetadata('interdigit_timeout') / 1000).toString() 
										: '5',
									collection_name: node.getMetadata('collection_name') || '',
									max_digits: node.getMetadata('max_digits') || '4',
									terminator: node.getMetadata('terminator') || '#',
									timeout: node.getMetadata('timeout') 
										? (node.getMetadata('timeout') / 1000).toString() 
										: '10'
								}
							},
							submodule: 'misc'
						}));

						//monster.ui.tooltips(popup_html);

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#collect_dtmf_collection_input', popup_html).val();
							
							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#collect_dtmf_collection_input', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var setData = function(field, value) {
								if (value !== 'default' && value !== '') {
									node.setMetadata(field, value);
								} else {
									node.deleteMetadata(field);
								}
							};

							// convert interdigit timeout value to milliseconds
							let interdigitTimeoutSeconds = $('#collect_dtmf_interdigit_input', popup_html).val();
							let interdigitTimeoutMilliseconds = interdigitTimeoutSeconds * 1000;

							// convert timeout value to milliseconds
							let timeoutSeconds = $('#collect_dtmf_timeout_input', popup_html).val();
							let timeoutMilliseconds = timeoutSeconds * 1000;

							setData('interdigit_timeout', interdigitTimeoutMilliseconds);
							setData('collection_name', $('#collect_dtmf_collection_input', popup_html).val());
							setData('max_digits', $('#collect_dtmf_max_digits_input', popup_html).val());
							setData('terminator', $('#collect_dtmf_terminator_input', popup_html).val());
							setData('timeout', timeoutMilliseconds);

							popup.dialog('close');
						});

						// alert for invalid interdigit timeout value
						$('#collect_dtmf_interdigit_input', popup_html).change(function() {
						
							inputValue = $('#collect_dtmf_interdigit_input', popup_html).val();

							if (inputValue < 5 || inputValue > 20) {
								$('#collect_dtmf_interdigit_input', popup_html).val(5);
								monster.ui.alert('warning', self.i18n.active().callflows.collectDTMF.interdigitTimeout.alert);
							}
						
						});

						// alert for invalid request timeout value
						$('#collect_dtmf_timeout_input', popup_html).change(function() {
						
							inputValue = $('#collect_dtmf_timeout_input', popup_html).val();

							if (inputValue < 5 || inputValue > 20) {
								$('#collect_dtmf_timeout_input', popup_html).val(10);
								monster.ui.alert('warning', self.i18n.active().callflows.collectDTMF.timeout.alert);
							}
						
						});

						// alert for invalid max digits value
						$('#collect_dtmf_max_digits_input', popup_html).change(function() {
						
							inputValue = $('#collect_dtmf_max_digits_input', popup_html).val();

							if (inputValue < 1 || inputValue > 40) {
								$('#collect_dtmf_max_digits_input', popup_html).val(4);
								monster.ui.alert('warning', self.i18n.active().callflows.collectDTMF.maxDigits.alert);
							}
						
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.collectDTMF.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'sleep[]': {
					name: self.i18n.active().callflows.sleep.name,
					icon: 'dot_chat',
					google_icon: 'pause',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'sleep',
					tip: self.i18n.active().callflows.sleep.tip,
					data: {
						duration: '',
						unit: 's'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('sleep[]'),
					weight: 47,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'sleep',
							data: {
								data_sleep: {
									'duration': node.getMetadata('duration')
								}
							},
							submodule: 'misc'
						}));

						monster.ui.tooltips(popup_html);

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#sleep_duration_input', popup_html).val();
							
							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#sleep_duration_input', popup_html).change(toggleSaveButton);

						$('#add', popup_html).click(function() {
							var setData = function(field, value) {
								if (value !== 'default') {
									node.setMetadata(field, value);
								} else {
									node.deleteMetadata(field);
								}
							};

							setData('duration', $('#sleep_duration_input', popup_html).val());

							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.sleep.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'tts[]': {
					name: self.i18n.active().callflows.tts.name,
					icon: 'chat_circle',
					google_icon: 'text_to_speech',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'tts',
					tip: self.i18n.active().callflows.tts.tip,
					data: {
						text: ''
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('tts[]'),
					weight: 45,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						var popup, popup_html;

						popup_html = $(self.getTemplate({
							name: 'tts',
							data: {
								miscSettings: miscSettings,
								data_tts: {
									'text': node.getMetadata('text'),
									'language': node.getMetadata('language'),
									'voice': node.getMetadata('voice')
								}
							},
							submodule: 'misc'
						}));

						monster.ui.tooltips(popup_html);

						// set tts languages based on dt-callflows whitelabel configuration
						if(miscSettings.ttsSetLanguages) {

							var languages = {};
							var voices = {};

							// split the ttsVoices into languages and voices
							ttsLanguages.forEach(function(voice) {
								var parts = voice.split('/'),
									lang = parts[1];

								if (!languages[lang]) {
									languages[lang] = lang;
								}

								if (!voices[lang]) {
									voices[lang] = [];
								}
								voices[lang].push(voice);

							});

							// populate the language dropdown
							var languageSelect = $('#tts_language_input', popup_html);
							for (var lang in languages) {
								languageSelect.append(new Option(lang, lang));
							}

							// populate the voice dropdown based on the selected language
							var voiceSelect = $('#tts_voice_input', popup_html);
							languageSelect.change(function() {
								var selectedLanguage = $(this).val();
								voiceSelect.empty();
								if (voices[selectedLanguage]) {
									voices[selectedLanguage].forEach(function(voice) {
										var gender = voice.split('/')[0]; // extract gender from the voice string
										voiceSelect.append(new Option(gender, gender)); // add the gender to the dropdown
									});
								}
							});

							// set the voice dropdown based on the selected language on form load
							languageSelect.trigger('change');

							// set the initial values if data exists
							if (node.getMetadata('language')) {
								languageSelect.val(node.getMetadata('language')).change();
							}
							if (node.getMetadata('voice')) {
								voiceSelect.val(node.getMetadata('voice'));
							}

						}

						// enable or disable the save button based on the input value
						function toggleSaveButton() {
							var inputValue = $('#tts_text_input', popup_html).val();
							
							if (inputValue == '') {
								$('#add', popup_html).prop('disabled', true);
							} else {
								$('#add', popup_html).prop('disabled', false);
							}
						}

						toggleSaveButton();

						$('#tts_text_input', popup_html).change(toggleSaveButton);
						
						$('#add', popup_html).click(function() {
							var setData = function(field, value) {
								if (value !== 'default') {
									node.setMetadata(field, value);
								} else {
									node.deleteMetadata(field);
								}
							};

							
							setData('text', $('#tts_text_input', popup_html).val());
							setData('language', $('#tts_language_input', popup_html).val());
							setData('voice', $('#tts_voice_input', popup_html).val());
							


							popup.dialog('close');
						});

						popup = monster.ui.dialog(popup_html, {
							title: self.i18n.active().callflows.tts.title,
							beforeClose: function() {
								if (typeof callback === 'function') {
									callback();
								}
							}
						});
					}
				},
				'response[]': {
					name: self.i18n.active().oldCallflows.response,
					icon: 'rightarrow',
					google_icon: 'reply',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'response',
					tip: self.i18n.active().oldCallflows.response_tip,
					data: {
						code: '',
						message: '',
						media: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('response[]'),
					weight: 100,
					caption: function(node) {
						return self.i18n.active().oldCallflows.sip_code_caption + node.getMetadata('code');
					},
					edit: function(node, callback) {
						self.miscMediaList(function(data) {
							var popup, popup_html;

							var selectedId = node.data.data.media || '',
								selectedItem = _.find(data, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: data,
									resource: 'media',
									resourceId: 'mediaId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}

							function renderPopup(itemNotFound) {
								popup_html = $(self.getTemplate({
									name: 'response',
									data: {
										response_data: {
											items: data,
											media_enabled: node.getMetadata('media') ? true : false,
											selected_media: node.getMetadata('media') || '',
											code: node.getMetadata('code') || '',
											message: node.getMetadata('message') || ''
										}
									},
									submodule: 'misc'
								}));

								var selector = popup_html.find('#media_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Media Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#media_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup_small');

								// update label padding based on media selector value
								function updateLabelPadding() {
									var mediaValue = $('#media_selector', popup_html).val();
									var label = $('.popup_field label[for="media_selector"]', popup_html);
					
									if (mediaValue === 'null' || mediaValue === undefined) {
										label.css('padding-bottom', '22px');
									} else {
										label.css('padding-bottom', '45px');
									}
									
								}
					
								updateLabelPadding();

								$('#media_selector', popup_html).change(updateLabelPadding);

								if ($('#media_selector option:selected', popup_html).val() === undefined
								|| $('#media_selector option:selected', popup_html).val() === 'null') {
									$('#edit_link', popup_html).hide();
								}

								$('#media_selector', popup_html).change(function() {
									if ($('#media_selector option:selected', popup_html).val() === undefined
									|| $('#media_selector option:selected', popup_html).val() === 'null') {
										$('#edit_link', popup_html).hide();
									} else {
										$('#edit_link', popup_html).show();
									}
								});

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#media_selector', popup_html).val() } : {};

									ev.preventDefault();

									monster.pub('callflows.media.editPopup', {
										data: _data,
										callback: function(_data) {
											node.setMetadata('media', _data.data.id || 'null');

											popup.dialog('close');
										}
									});
								});

								// enable or disable the save button based on the input value
								function toggleSaveButton() {
									var inputValue = $('#response_code_input', popup_html).val();
									
									if (inputValue == '') {
										$('#add', popup_html).prop('disabled', true);
									} else {
										$('#add', popup_html).prop('disabled', false);
									}
								}

								toggleSaveButton();

								$('#response_code_input', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									if ($('#response_code_input', popup_html).val().match(/^[1-6][0-9]{2}$/)) {
										node.setMetadata('code', $('#response_code_input', popup_html).val());
										node.setMetadata('message', $('#response_message_input', popup_html).val());
										if ($('#media_selector', popup_html).val() && $('#media_selector', popup_html).val() !== 'null') {
											node.setMetadata('media', $('#media_selector', popup_html).val());
										} else {
											node.deleteMetadata('media');
										}

										node.caption = self.i18n.active().oldCallflows.sip_code_caption + $('#response_code_input', popup_html).val();

										popup.dialog('close');
									} else {
										monster.ui.alert('error', self.i18n.active().oldCallflows.please_enter_a_valide_sip_code);
									}
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.response_title,
									minHeight: '0',
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, 'play');
					}
				},
				'missed_call_alert[]': {
					name: self.i18n.active().callflows.missedCallAlert.title,
					icon: 'bell1',
					google_icon: 'call_missed',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'missed_call_alert',
					tip: self.i18n.active().callflows.missedCallAlert.tip,
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
					isListed: determineIsListed('missed_call_alert[]'),
					weight: 31,
					caption: function() {
						return '';
					},
					edit: function(node, callback) {
						self.miscEditMissedCallAlerts(node, callback);
					}
				},
				'set_variables[]': {
					name: self.i18n.active().callflows.setCav.title,
					icon: 'settings2',
					google_icon: 'manufacturing',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'set_variables',
					tip: self.i18n.active().callflows.setCav.tip,
					data: {
						custom_application_vars: {}
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('set_variables[]'),
					weight: 31,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						self.miscEditSetCAV(node, callback);
					}
				},
				'webhook[]': {
					name: self.i18n.active().callflows.webhook.title,
					icon: 'to_cloud',
					google_icon: 'webhook',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'webhook',
					tip: self.i18n.active().callflows.webhook.tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('webhook[]'),
					weight: 170,
					caption: function() {
						return '';
					},
					edit: function(node, callback) {
						self.miscRenderEditWebhook(node, callback);
					}
				},
				'dimensionsCallTag[id=*]': {
					name: self.i18n.active().callflows.callTag.title,
					icon: 'to_cloud',
					google_icon: 'sell',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'webhook',
					tip: self.i18n.active().callflows.callTag.tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: miscSettings.enableDimensionsCallTagAction && determineIsListed('dimensionsCallTag[id=*]'),
					weight: 90,
					caption: function() {
						return '';
					},
					edit: function(node, callback) {
						self.miscRenderEditCallTag(node, callback);
					}
				},
				'dimensionsDirectoryRouting[id=*]': {
					name: self.i18n.active().callflows.directoryRouting.title,
					icon: 'book',
					google_icon: 'folder_data',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'pivot',
					tip: self.i18n.active().callflows.directoryRouting.tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						},
						{
							type: 'allowedChildren',
							action: [
								'callflow[id=*]'
							]
						}
					],
					isUsable: 'true',
					isListed: miscSettings.enableDimensionsDirectoryRoutingAction && determineIsListed('dimensionsDirectoryRouting[id=*]'),
					weight: 78,
					caption: function() {
						return '';
					},
					edit: function(node, callback) {
						self.miscRenderEditDirectoryRouting(node, callback);
					}
				}
			}

			$.extend(callflow_nodes, actions);

		},

		/* Render edit dialogs */
		miscEditMissedCallAlerts: function(node, callback) {
			var self = this,
				recipients = node.getMetadata('recipients'),
				mapUsers = {},
				selectedEmails = [],
				popup;

			_.each(recipients, function(recipient) {
				if (recipient.type === 'user') {
					mapUsers[recipient.id] = recipient;
				} else if (recipient.type === 'email') {
					selectedEmails.push(recipient.id);
				}
			});

			self.miscUserList(function(users) {
				var items = [],
					selectedItems = [];

				_.each(users, function(user) {
					var formattedUser = {
						key: user.id,
						value: user.first_name + ' ' + user.last_name
					};

					items.push(formattedUser);

					if (mapUsers.hasOwnProperty(user.id)) {
						selectedItems.push(formattedUser);
					}
				});

				var template = $(self.getTemplate({
						name: 'missedCallAlert-dialog',
						data: {
							emails: selectedEmails.toString()
						},
						submodule: 'misc'
					})),
					widget = monster.ui.linkedColumns(template.find('.items-selector-wrapper'), items, selectedItems, {
						i18n: {
							columnsTitles: {
								available: self.i18n.active().callflows.missedCallAlert.unselectedUsers,
								selected: self.i18n.active().callflows.missedCallAlert.selectedUsers
							}
						},
						containerClasses: 'skinny'
					});

				
				// function to validate an email address
				function isValidEmail(email) {
					var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
					return emailRegex.test(email) && email.split('@')[1].split('.').length > 1;
				}

				// enable or disable the save button based on the users or emails value
				function toggleSaveButton() {
					var emails = template.find('#emails').val().replace(/\s/g, '').split(','),
						userCount = widget.getSelectedItems().length,
						hasValidEmails;
					
					if (emails.length == 1 && emails[0] == '') {
						hasValidEmails = null;
					} else {
						hasValidEmails = emails.every(email => email === '' || isValidEmail(email));
					}
										
					if (hasValidEmails == null && userCount >= 1 || hasValidEmails >= 1 && userCount >= 1 || hasValidEmails >= 1 && userCount == 0) {
						$('#save_missed_call_alerts', template).prop('disabled', false);
					} else {
						$('#save_missed_call_alerts', template).prop('disabled', true);
					}
				}
		
				toggleSaveButton();
		
				$('#emails', template).change(toggleSaveButton);
				
				template.find('#save_missed_call_alerts').on('click', function() {
					var recipients = [],
						emails = template.find('#emails').val();

					emails = emails.replace(/\s/g, '').split(',');

					_.each(emails, function(email) {
						recipients.push({
							type: 'email',
							id: email
						});
					});

					_.each(widget.getSelectedItems(), function(id) {
						recipients.push({
							type: 'user',
							id: id
						});
					});

					node.setMetadata('recipients', recipients);

					popup.dialog('close');
				});

				popup = monster.ui.dialog(template, {
					title: self.i18n.active().callflows.missedCallAlert.popupTitle,
					beforeClose: function() {
						if (typeof callback === 'function') {
							callback();
						}
					}
				});

				// monitor for changes to the selected column
				var observer = new MutationObserver(toggleSaveButton),
					selectedColumn = template.find('.selected').get(0),
					config = { childList: true, subtree: true };

				observer.observe(selectedColumn, config);

				popup.on('dialogclose', function() {
					observer.disconnect();
				});

			});
		},

		miscEditSetCAV: function(node, callback) {
			var self = this,
				variables = _.extend({}, node.getMetadata('custom_application_vars')),
				formData;
		
			function checkFormValidity(template) {
				formData = monster.ui.getFormData('set_cav_form');
				var items = formData.items;
		
				var hasEmptyKeyOrValue = items.some(function(item) {
					return _.isEmpty(item.key) || _.isEmpty(item.value);
				});
		
				if (hasEmptyKeyOrValue) {
					$('#save_cav_variables', template).prop('disabled', true);
				} else {
					$('#save_cav_variables', template).prop('disabled', false);
				}
			}
		
			var initTemplate = function() {
				var template = $(self.getTemplate({
						name: 'setcav-dialog',
						data: { variables: variables },
						submodule: 'misc'
					})),
					popup;
		
				if (_.size(variables) <= 0) {
					addRow(template);
				}
		
				_.each(variables, function(variable, key) {
					addRow(template, { key: key, value: variable });
				});
		
				popup = monster.ui.dialog(template, {
					title: self.i18n.active().callflows.setCav.popupTitle,
					width: 500,
					beforeClose: function() {
						if (typeof callback === 'function') {
							callback();
						}
					}
				});
		
				bindSetCavEvents({ template: template, popup: popup });
			},
		
			bindSetCavEvents = function(args) {
				var template = args.template,
					popup = args.popup;
		
				template.find('.cav-add-row').on('click', function() {
					addRow(template);
					checkFormValidity(template);
				});
		
				template.on('change', '.cav-key, .cav-value', function() {
					checkFormValidity(template);
				});
		
				template.find('#save_cav_variables').on('click', function() {
					formData = monster.ui.getFormData('set_cav_form');
					var variables = _.chain(formData.items)
						.reject(function(item) {
							return _.isEmpty(item.key) || _.isEmpty(item.value);
						})
						.keyBy('key')
						.mapValues('value')
						.value();
		
					node.setMetadata('custom_application_vars', variables);
					popup.dialog('close');
				});
		
				checkFormValidity(template);
			},
		
			addRow = function(template, data) {
				var cavRow = $(self.getTemplate({
					name: 'setcav-row',
					submodule: 'misc',
					data: _.merge(data, {
						index: template.find('.cav-list tbody tr').length + 1
					})
				}));
		
				template.find('.cav-list tbody').append(cavRow);
		
				template.find('.cav-remove-row').off('click').on('click', function() {
					if (template.find('.cav-list tbody tr').length > 1) {
						$(this).closest('tr').remove();
						checkFormValidity(template);
					}
				});
			};
		
			initTemplate();
		},

		miscRenderEditWebhook: function(node, callback) {
			var self = this,
				popup,
				initTemplate = function() {
					var data = {
							hasVerbWithFormat: _.includes(self.appFlags.misc.webhook.verbsWithFormat, node.getMetadata('http_verb')),
							bodyFormatList: _.map(self.appFlags.misc.webhook.bodyFormats, function(item) {
								return {
									value: item,
									label: _.get(self.i18n.active().callflows.webhook.format.options, _.camelCase(item), monster.util.formatVariableToDisplay(item))
								};
							}),
							httpVerbsList: self.appFlags.misc.webhook.httpVerbs,
							format: node.getMetadata('format', ''),
							uri: node.getMetadata('uri', ''),
							http_verb: node.getMetadata('http_verb', 'get'),
							retries: node.getMetadata('retries', 1),
							custom_data: node.getMetadata('custom_data', {})
						},
						$template = $(self.getTemplate({
							name: 'webhook-callflowEdit',
							data: data,
							submodule: 'misc'
						})),
						$form = $template.find('#webhook_form');

					monster.ui.keyValueEditor($template.find('.custom-data-container'), {
						data: data.custom_data,
						inputName: 'custom_data'
					});

					monster.ui.tooltips($template);

					/*
					monster.ui.validate($form, {
						rules: {
							uri: {
								required: true,
								url: true
							}
						},
						messages: {
							uri: {
								url: self.i18n.active().callflows.webhook.uri.errorMessages.url
							}
						}
					});
					*/

					// enable or disable the save button based on the input value
					function toggleSaveButton() {
						var inputValue = $template.find('#uri').val();
		
						if (inputValue === '') {
							$template.find('#add').prop('disabled', true);
						} else if (!(inputValue.startsWith('http://') || inputValue.startsWith('https://'))) {
							$template.find('#add').prop('disabled', true);
							monster.ui.alert('warning', self.i18n.active().callflows.webhook.uri.invalid);
						} else {
							$template.find('#add').prop('disabled', false);
						}
					}
		
					toggleSaveButton();
		
					$template.find('#uri').on('change', toggleSaveButton);

					// alert for invalid retries value
					$template.find('#retries').on('change', function() {
						inputValue = $template.find('#retries').val();
						if (inputValue < 1 || inputValue > 4) {
							$template.find('#retries').val(1);
							monster.ui.alert('warning', self.i18n.active().callflows.webhook.retries.invalid);
						}
					});

					$template.find('#http_verb').on('change', function() {
						var $this = $(this),
							newValue = $this.val(),
							$formPopupField = $template.find('#form_popup_field'),
							animationMethod = _.includes(self.appFlags.misc.webhook.verbsWithFormat, newValue) ? 'slideDown' : 'slideUp';

						$formPopupField[animationMethod](250);
					});

					$template.find('#add').on('click', function(e) {
						e.preventDefault();

						if (!monster.ui.valid($form)) {
							return;
						}

						var formData = monster.ui.getFormData('webhook_form');

						_.each(formData, function(value, key) {
							if (key === 'custom_data') {
								value = _
									.chain(value)
									.keyBy('key')
									.mapValues('value')
									.value();
							} else if (key === 'retries') {
								value = _.parseInt(value, 10);
							} else if (
								key === 'format'
								&& !_.includes(self.appFlags.misc.webhook.verbsWithFormat, formData.http_verb)
							) {
								node.deleteMetadata('format');
								return;
							}

							node.setMetadata(key, value);
						});

						popup.dialog('close');
					});

					return $template;
				};

			popup = monster.ui.dialog(initTemplate(), {
				title: self.i18n.active().callflows.webhook.popupTitle,
				beforeClose: function() {
					if (_.isFunction(callback)) {
						callback();
					}
				}
			});
		},

		miscRenderEditCallTag: function(node, callback) {
			var self = this,
				selectedTag,
				dimensionData = node.getMetadata('dimension', ''),
				data = {			
					callTags: callTags,
					dimension: dimensionData
				},
				popup_html = $(self.getTemplate({
					name: 'webhookCallTag-callflowEdit',
					data: data,
					submodule: 'misc'
				})),
				popup;

			$('#tagDeletedMessage', popup_html).hide();
			
			// populate the tagValue field with the existing dimension.tagValue if present
			var tagValue = dimensionData.tagValue || '';
			popup_html.find('#tagValue').val(tagValue);

			// get selected call tag data
			function getTagData() {
				var selectedTagId = popup_html.find('#name').val();
					selectedTag = _.find(callTags, { id: selectedTagId }),
					nodeData = node.data.data;
				
				$('#tagValue', popup_html).prop('disabled', true);
				$('#add', popup_html).prop('disabled', true);
		
				if (miscSettings.enableConsoleLogging) {
					console.log('selectedTag', selectedTag);
				}
	
				if (selectedTag) {
					var $tagValueField = popup_html.find('#tagValue');
					
   					$tagValueField.val(null);

					if (selectedTag.type == 'StringListTagValueType') {

						$('#tagValue', popup_html).prop('disabled', false);
					
						var dropdown = $('<select>', { id: 'tagValue', name: 'tagValue' });
					
						dropdown.append($('<option>', { value: '', text: 'Select a tag value', hidden: true }));

						var selectedValue;

						if (nodeData.hasOwnProperty('dimension') && nodeData.dimension.type == 'StringListTagValueType') {
							selectedValue = dimensionData.tagValue;
						} else if (selectedTag.hasOwnProperty('defaultValue')) {
							selectedValue = selectedTag.defaultValue;
						} else {
							selectedValue = '';
						}
					
						_.each(selectedTag.values, function(value) {
							var option = $('<option>', { value: value, text: value });
							
							if (value == selectedValue) {
								option.prop('selected', true);
							}
					
							dropdown.append(option);
						});
					
						$tagValueField.replaceWith(dropdown);
					
						if (selectedTag.defaultValue != undefined || selectedValue != '') {
							$('#add', popup_html).prop('disabled', false);
						}
					
					}
					
					if (selectedTag.type == 'BoolTagValueType') {

						$('#tagValue', popup_html).prop('disabled', false);

						var boolDropdown = $('<select>', { id: 'tagValue', name: 'tagValue' });
						
						boolDropdown.append($('<option>', { value: '', text: 'Select a tag value', hidden: true }));
						boolDropdown.append($('<option>', { value: 'Yes', text: 'Yes' }));
						boolDropdown.append($('<option>', { value: 'No', text: 'No' }));
					
						var selectedValue;

						if (nodeData.hasOwnProperty('dimension') && nodeData.dimension.type == 'BoolTagValueType') {
							selectedValue = dimensionData.tagValue;
						} else if (selectedTag.hasOwnProperty('defaultValue')) {
							selectedValue = selectedTag.defaultValue === true ? 'Yes' : 'No';
						} else {
							selectedValue = '';
						}

						boolDropdown.find(`option[value="${selectedValue}"]`).prop('selected', true);
					
						$tagValueField.replaceWith(boolDropdown);

						if (selectedTag.defaultValue != undefined || selectedValue != '') {
							$('#add', popup_html).prop('disabled', false);
						}
					
					}
					
	
					if (selectedTag.type == 'StringTagValueType') {

						$('#tagValue', popup_html).prop('disabled', false);

						var formValue;

						if (nodeData.hasOwnProperty('dimension') && nodeData.dimension.type == 'StringTagValueType') {
							formValue = dimensionData.tagValue;
						} else if (selectedTag.hasOwnProperty('defaultValue')) {
							formValue = selectedTag.defaultValue;
						} else {
							formValue = '';
						}

						var textInput = $('<input>', {
							type: 'text',
							id: 'tagValue',
							name: 'tagValue',
							value: formValue
						});
						
						$tagValueField.replaceWith(textInput);

						if (selectedTag.defaultValue != undefined || formValue != '') {
							$('#add', popup_html).prop('disabled', false);
						}

					}

					if (selectedTag.type == 'LinkTagValueType') {

						$('#tagValue', popup_html).prop('disabled', false);

						var formValue;

						if (nodeData.hasOwnProperty('dimension') && nodeData.dimension.type == 'LinkTagValueType') {
							formValue = dimensionData.tagValue;
						} else if (selectedTag.hasOwnProperty('defaultValue')) {
							formValue = selectedTag.defaultValue;
						} else {
							formValue = '';
						}

						var textInput = $('<input>', {
							type: 'text',
							id: 'tagValue',
							name: 'tagValue',
							value: formValue
						});
						
						$tagValueField.replaceWith(textInput);

						if (selectedTag.defaultValue != undefined || formValue != '') {
							$('#add', popup_html).prop('disabled', false);
						}

					}
					
					if (selectedTag.type == 'NumericRangeTagValueType') {

						$('#tagValue', popup_html).prop('disabled', false);
					
						var formValue;
					
						if (nodeData.hasOwnProperty('dimension') && nodeData.dimension.type == 'NumericRangeTagValueType') {
							formValue = dimensionData.tagValue;
						} else if (selectedTag.hasOwnProperty('defaultValue')) {
							formValue = selectedTag.defaultValue;
						} else {
							formValue = '';
						}
						
						var numericInput = $('<input>', {
							type: 'text',
							id: 'tagValue',
							name: 'tagValue',
							value: formValue,
							inputmode: 'numeric',
							pattern: '[0-9]*'
						});
						
						// prevent non-numeric input using the keypress event
						numericInput.on('keypress', function(event) {
							var charCode = event.which ? event.which : event.keyCode;
							// allow only digits (0-9)
							if (charCode < 48 || charCode > 57) {
								event.preventDefault();
							}
						});
						
						$tagValueField.replaceWith(numericInput);
					
						if (selectedTag.defaultValue != undefined || formValue != '') {
							$('#add', popup_html).prop('disabled', false);
						}
					
					}
					
				} 
				
				// handle scenario where selectedTag is not found due to the tag being deleted
				if (!selectedTag && nodeData.hasOwnProperty('dimension')) {

					var $callTagField = popup_html.find('#name'), 
						$tagValueField = popup_html.find('#tagValue');
					
					var callTagInput = $('<input>', {
						type: 'text',
						id: 'name',
						name: 'name',
						value: dimensionData.name
					});
					
					$callTagField.replaceWith(callTagInput);

					var tagValueInput = $('<input>', {
						type: 'text',
						id: 'tagValue',
						name: 'tagValue',
						value: dimensionData.tagValue
					});
					
					$tagValueField.replaceWith(tagValueInput);

					$('#name', popup_html).prop('disabled', true);
					$('#tagValue', popup_html).prop('disabled', true);
					$('#add', popup_html).prop('disabled', true);

					$('#tagDeletedMessage', popup_html).show();

				}

			}

			getTagData();

			popup_html.find('#name').on('change', getTagData);

			// enable or disable the save button based on the tag value
			function toggleSaveButton() {

				if (selectedTag) {
					var tagValue = popup_html.find('#tagValue').val();

					if (tagValue == '') {
						$('#add', popup_html).prop('disabled', true);
					} else if (tagValue != '' && selectedTag.type == 'NumericRangeTagValueType') {
						if (tagValue < selectedTag.min || tagValue > selectedTag.max) {
							$('#add', popup_html).prop('disabled', true);
							popup_html.find('#tagValue').val('')
							monster.ui.alert('warning', self.i18n.active().callflows.callTag.numericInputInvalid + selectedTag.min + ' - ' + selectedTag.max);
						} else {
							$('#add', popup_html).prop('disabled', false);
						}
					} else {
						$('#add', popup_html).prop('disabled', false);
					}
				}				
			}

			toggleSaveButton();

			popup_html.on('change', '#tagValue', toggleSaveButton);
			
			$('#add', popup_html).click(function() {
				
				var encodedTagValue,
					tagUri,
					tagValue = $('#tagValue', popup_html).val();

				if (selectedTag.type == 'BoolTagValueType') {
					encodedTagValue = tagValue == 'Yes' ? 'true' : 'false';
       				tagUri = selectedTag.endpoint + encodedTagValue;
				} else {
					encodedTagValue = encodeURIComponent(tagValue),
					tagUri = selectedTag.endpoint + encodedTagValue;
				}	

				node.setMetadata('uri', tagUri),
				node.setMetadata('format', 'json'),
				node.setMetadata('http_verb', 'post'),
				node.setMetadata('retries', 1),
				node.setMetadata('dimension', {
					'id': selectedTag.id,
					'name': selectedTag.name,
					'type': selectedTag.type,
					'endpoint': selectedTag.endpoint,
					'tagValue': $('#tagValue', popup_html).val()
				});

				var callTagCaption = selectedTag.name + ': ' + $('#tagValue', popup_html).val();
				node.caption = callTagCaption;
				
				popup.dialog('close');
			});

			popup = monster.ui.dialog(popup_html, {
				title: self.i18n.active().callflows.callTag.popupTitle,
				beforeClose: function() {
					if (typeof callback === 'function') {
						callback();
					}
				}
			});
	
		},

		miscRenderEditDirectoryRouting: function(node, callback) {
			var self = this,
				selectedDirectory,
				dimensionData = node.getMetadata('dimension', ''),
				data = {			
					contactDirectories: contactDirectories,
					dimension: dimensionData
				},
				popup_html = $(self.getTemplate({
					name: 'pivotDirectoryRouting',
					data: data,
					submodule: 'misc'					
				})),
				popup;

			$('#directoryFallbackMessage', popup_html).show();
			$('#directoryDeletedMessage', popup_html).hide();

			// populate the directory field with the existing dimension.directoryValue if present
			var directoryValue = dimensionData.directoryValue || '';
			popup_html.find('#directoryValue').val(directoryValue);

			// get directory data
			function getDirectoryData() {
				var selectedDirectoryId = popup_html.find('#name').val();
					selectedDirectory = _.find(contactDirectories, { id: selectedDirectoryId }),
					nodeData = node.data.data;
				
				$('#directoryDescription', popup_html).prop('disabled', true);
				$('#directoryValue', popup_html).prop('disabled', true);
				$('#add', popup_html).prop('disabled', true);

				if (miscSettings.enableConsoleLogging) {
					console.log('selectedDirectory', selectedDirectory);
				}

				if (selectedDirectory) {
					$('#directoryDescription', popup_html).val(selectedDirectory.description || null);
				}
				
				// handle scenario where selectedDirectory is not found due to the directory being deleted
				if (!selectedDirectory && nodeData.hasOwnProperty('dimension')) {

					var $directoryField = popup_html.find('#name'), 
						$routingValueField = popup_html.find('#routingValue');
					
					var callTagInput = $('<input>', {
						type: 'text',
						id: 'name',
						name: 'name',
						value: dimensionData.name
					});
					
					$directoryField.replaceWith(callTagInput);

					function formatRoutingValue(routingValue) {
						const numberPart = routingValue.replace("field", "");
						return `Field ${numberPart}`;
					}

					var tagValueInput = $('<input>', {
						type: 'text',
						id: 'routingValue',
						name: 'routingValue',
						value: formatRoutingValue(dimensionData.routingValue)
					});
					
					$routingValueField.replaceWith(tagValueInput);

					$('#name', popup_html).prop('disabled', true);
					$('#routingValue', popup_html).prop('disabled', true);
					$('#add', popup_html).prop('disabled', true);

					$('#directoryFallbackMessage', popup_html).hide();
					$('#directoryDeletedMessage', popup_html).show();
					
				}

			}
				
			getDirectoryData();

			popup_html.find('#name').on('change', getDirectoryData);

			// enable or disable the save button
			function toggleSaveButton() {

				if (selectedDirectory) {
					
					var routingValue = popup_html.find('#routingValue').val();

					if (routingValue == 'null') {
						$('#add', popup_html).prop('disabled', true);
					} else {
						$('#add', popup_html).prop('disabled', false);
					}
				}				
			}

			toggleSaveButton();

			popup_html.on('change', '#name', toggleSaveButton);
			popup_html.on('change', '#routingValue', toggleSaveButton);

			$('#add', popup_html).click(function() {

				var routingValue = $('#routingValue', popup_html).val(),
					directoryUri = selectedDirectory.endpoint + '/' + routingValue;
				
				node.setMetadata('voice_url', directoryUri);
				node.setMetadata('method', 'POST');
				node.setMetadata('req_format', 'kazoo');
				node.setMetadata('req_timeout', '6');
				node.setMetadata('dimension', {
					'id': selectedDirectory.id,
					'name': selectedDirectory.name,
					'description': selectedDirectory.description,
					'endpoint': selectedDirectory.endpoint,
					'routingValue': $('#routingValue', popup_html).val()
				});

				var callTagCaption = selectedDirectory.name;
				node.caption = callTagCaption;

				popup.dialog('close');

			});

			popup = monster.ui.dialog(popup_html, {
				title: self.i18n.active().callflows.directoryRouting.popupTitle,
				beforeClose: function() {
					if (typeof callback === 'function') {
						callback();
					}
				}
			});
	
		},
		
		/* API helpers */
		miscDeviceList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
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

		miscGroupList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'group.list',
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

		miscUserList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
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

		miscMediaList: function(callback, mediaAction) {
			var self = this;

			var mediaFilters = {
				paginate: false
			};

			if (miscSettings.enableCustomCallflowActions && miscSettings.responseActionHideMailboxMedia) {
				if (mediaAction == 'play') {
					mediaFilters['filter_not_media_source'] = 'recording';
				}
				if (mediaAction == 'mailboxMedia') {
					mediaFilters['filter_media_source'] = 'recording';
				}
			}

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: mediaFilters
				},
				success: function(data, status) {
					// sort media alphabetically by name
					var sortedMedia = data.data.sort((a, b) => a.name.localeCompare(b.name));
					callback && callback(sortedMedia);
				}
			});
		}
	};

	return app;
});
