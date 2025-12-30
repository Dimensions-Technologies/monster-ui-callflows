define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone'),
		hideAdd = false,
		hideClassifiers = {},
		miscSettings = {};

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'userDefineActions',
			'callflows.user.popupEdit': 'userPopupEdit',
			'callflows.user.edit': 'userEdit',
			'callflows.user.submoduleButtons': 'userSubmoduleButtons'
		},

		random_id: false,

		userDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				hideCallflowAction = args.hideCallflowAction;

			// set variables for use elsewhere
			hideAdd = args.hideAdd;
			hideClassifiers = args.hideClassifiers,
			miscSettings = args.miscSettings;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			}

			var actions = {
				'user[id=*]': {
					name: self.i18n.active().callflows.user.user,
					icon: 'user',
					google_icon: 'person',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'user',
					tip: self.i18n.active().callflows.user.user_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('user[id=*]'),
					weight: 40,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						self.userList(function(users) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
									selectedItem = _.find(users, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: users,
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
								$.each(users, function() {
									this.name = this.first_name + ' ' + this.last_name;
								});

								popup_html = $(self.getTemplate({
									name: 'callflowEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										hideAdd: args.hideAdd,
										can_call_self: node.getMetadata('can_call_self') || false,
										parameter: {
											name: 'timeout (s)',
											value: node.getMetadata('timeout') || '20'
										},
										objects: {
											items: _.sortBy(users, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'user'
								}));

								if ($('#user_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#user_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.userPopupEdit({
										data: _data,
										callback: function(_data) {
											node.setMetadata('id', _data.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#user_can_call_self', popup_html).is(':checked'));

											node.caption = (_data.first_name || '') + ' ' + (_data.last_name || '');

											popup.dialog('close');
										}
									});
								});

								var selector = popup_html.find('#user_selector');

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

								if (miscSettings.deviceValidateRingTimeout) {
									// alert for invalid device timeout value
									$('#parameter_input', popup_html).change(function() {
									
										ringTimeout = $('#parameter_input', popup_html).val();

										if (ringTimeout < 10 || ringTimeout > 120) {
											$('#parameter_input', popup_html).val(20);
											monster.ui.alert('warning', self.i18n.active().oldCallflows.device_timeout_invalid);
										}
									
									});
								}

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#user_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#user_can_call_self', popup_html).is(':checked'));

									node.caption = $('#user_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.user.select_user,
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
							resource: 'user.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: false
								}
							},
							success: function(userData, status) {

								self.callApi({
									resource: 'callflow.list',
									data: {
										accountId: self.accountId,
										filters: {
											paginate: false,
											filter_type: 'mainUserCallflow'
										}
									},
									success: function(callflowData, status) {
										// build map of owner_id callflow info
										const callflowMap = {};

										callflowData.data.forEach(callflow => {
											if (callflow.owner_id) {
												callflowMap[callflow.owner_id] = {
													hasVoicemail: Array.isArray(callflow.modules) && callflow.modules.includes('voicemail'),
													numbers: Array.isArray(callflow.numbers) ? callflow.numbers : []
												};
											}
										});

										// enhance each user object
										userData.data.forEach(user => {
											const callflow = callflowMap[user.id];

											if (callflow) {
												// add voicemail to features if applicable
												if (callflow.hasVoicemail) {
													user.features = user.features || [];
													if (!user.features.includes('voicemail')) {
														user.features.push('voicemail');
													}
												}

												// add numbers to user object
												user.numbers = callflow.numbers.filter(number => number !== user.presence_id);
											}
										});

										callback && callback(userData.data);
									}
								});
							}
						});
					},
					editEntity: 'callflows.user.edit'
				},
				'hotdesk[action=login]': {
					name: self.i18n.active().callflows.user.hot_desk_login,
					icon: 'hotdesk_login',
					google_icon: 'desk',
					category: self.i18n.active().callflows.user.hotdesking_cat,
					module: 'hotdesk',
					tip: self.i18n.active().callflows.user.hot_desk_login_tip,
					data: {
						action: 'login'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('hotdesk[action=login]'),
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
				'hotdesk[action=logout]': {
					name: self.i18n.active().callflows.user.hot_desk_logout,
					icon: 'hotdesk_logout',
					google_icon: 'desk',
					category: self.i18n.active().callflows.user.hotdesking_cat,
					module: 'hotdesk',
					tip: self.i18n.active().callflows.user.hot_desk_logout_tip,
					data: {
						action: 'logout'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('hotdesk[action=logout]'),
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
				'hotdesk[action=toggle]': {
					name: self.i18n.active().callflows.user.hot_desk_toggle,
					icon: 'hotdesk_toggle',
					google_icon: 'desk',
					category: self.i18n.active().callflows.user.hotdesking_cat,
					module: 'hotdesk',
					tip: self.i18n.active().callflows.user.hot_desk_toggle_tip,
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
					isListed: determineIsListed('hotdesk[action=toggle]'),
					weight: 30,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				}
			}

			$.extend(callflow_nodes, actions);

		},

		userPopupEdit: function(args) {
			var self = this,
				popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>'),
				popup,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults;

			popup_html.css({
				height: 500,
				'overflow-y': 'scroll'
			});

			if (miscSettings.callflowButtonsWithinHeader) {
				miscSettings.popupEdit = true;
			}

			self.userEdit({
				data: data,
				parent: popup_html,
				target: $('.inline_content', popup_html),
				callbacks: {
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
							title: (data.id) ? self.i18n.active().callflows.user.edit_user : self.i18n.active().callflows.user.create_user
						});
					}
				},
				data_defaults: data_defaults
			});
		},

		userEdit: function(args) {
			var self = this,
				data = args.data,
				parent = args.parent || $('#user-content'),
				target = args.target || $('#user-view', parent),
				_callbacks = args.callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success || function(_data) {
						self.userRenderList(parent);

						self.userEdit({
							data: { id: _data.data.id },
							parent: parent,
							target: target,
							callbacks: callbacks
						});
					},

					save_error: _callbacks.save_error,

					delete_success: _callbacks.delete_success || function() {
						target.empty();

						self.userRenderList(parent);
					},

					delete_error: _callbacks.delete_error,

					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						apps: {},
						call_forward: {
							substitute: true
						},
						call_failover: {
							enabled: false
						},
						call_restriction: {
							closed_groups: { action: 'inherit' }
						},
						caller_id: {
							internal: {},
							external: {},
							emergency: {}
						},
						hotdesk: {},
						contact_list: {
							exclude: false
						},
						priv_level: 'user',
						music_on_hold: {},
						timezone: 'inherit'
					}, args.data_defaults || {}),
					field_data: {
						device_types: {
							sip_device: self.i18n.active().callflows.user.sip_device_type,
							cellphone: self.i18n.active().callflows.user.cell_phone_type,
							fax: self.i18n.active().callflows.user.fax_type,
							smartphone: self.i18n.active().callflows.user.smartphone_type,
							landline: self.i18n.active().callflows.user.landline_type,
							softphone: self.i18n.active().callflows.user.softphone_type,
							sip_uri: self.i18n.active().callflows.user.sip_uri_type
						},
						user_callflow: null,
						phone_numbers: [],
						extension_numbers: [],
						callflow_numbers: [],
						call_restriction: {},
						callflow_features: null,
						canImpersonate: monster.util.canImpersonate(self.accountId),
						ring_group: null,
						callflow_ring_group: null
					}
				};

			self.random_id = false;

			var userId = data.id,
				userCallflow = null;
			
			var parallelFunctions = _.merge({
				
				get_callflow: function(callback) {
					self.callApi({
						resource: 'callflow.list',
						data: {
							accountId: self.accountId,
							filters: {
								filter_owner_id: userId,
								filter_type: 'mainUserCallflow',
								paginate: false
							}
						},
						success: function(callflow) {

							if (callflow.data.length > 0 && callflow.data[0].numbers.length > 0) {

								// set callflow for the user
								defaults.field_data.user_callflow = callflow.data[0];
								userCallflow = callflow.data[0];
								
								// filter numbers to get phone numbers
								var phoneNumbers = callflow.data[0].numbers.filter(function(number) {
									if (miscSettings.fixedExtensionLength) {
										return number.length > 7;
									}
									else {
										return number.startsWith('+');
									}
								});

								var formattedPhoneNumbers = phoneNumbers.map(function(number) {
									return number;
								});

								// filter numbers to get extension numbers
								var extensionNumbers = callflow.data[0].numbers.filter(function(number) {
									if (miscSettings.fixedExtensionLength) {
										return number.length <= 7;
									}
									else {
										return !number.startsWith('+');
									}
								});
					
								var formattedExtensionNumbers = extensionNumbers.map(function(number) {
									return number
								});

								if (miscSettings.enableConsoleLogging) {
									console.log('User Callflow', callflow.data[0]);
									console.log('Callflow Features', callflow.data[0].modules);
									console.log('Phone Numbers', formattedPhoneNumbers);
									console.log('Extension Numbers', formattedExtensionNumbers);
								}
							
								defaults.field_data.callflow_numbers = callflow.data[0].numbers;
								defaults.field_data.phone_numbers = formattedPhoneNumbers;
								defaults.field_data.extension_numbers = formattedExtensionNumbers;
								defaults.field_data.callflow_features = callflow.data[0].modules;
								
							}

							callback(null, callflow);

						}

					});
				
				},
				
				phoneNumbers: function(next) {
					self.callApi({
						resource: 'numbers.listAll',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
						},
						success: _.flow(
							_.partial(_.get, _, 'data.numbers'),
							_.partial(_.map, _, function(meta, number) {
								return {
									number: number
								};
							}),
							_.partial(_.sortBy, _, 'number'),
							_.partial(next, null)
						),
						error: _.partial(_.ary(next, 2), null, [])
					});
				},
				list_classifiers: function(callback) {
					self.callApi({
						resource: 'numbers.listClassifiers',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
						},
						success: function(_data_classifiers, status) {
							
							/*
							if ('data' in _data_classifiers) {
								$.each(_data_classifiers.data, function(k, v) {
									defaults.field_data.call_restriction[k] = {
										friendly_name: v.friendly_name
									};

									console.log('classifier: '+ [k]);

									defaults.data.call_restriction[k] = { action: 'inherit' };
								});
							}
							*/

							if ('data' in _data_classifiers && typeof hideClassifiers === 'object') {
								$.each(_data_classifiers.data, function(k, v) {
									
									// check if k exists in hideClassifiers and its value is true
									if (hideClassifiers.hasOwnProperty(k) && hideClassifiers[k] === true) {
										// if k is in hideClassifiers and its value is true, skip processing
										return; 
									}
							
									// if k is not in hideClassifiers or its value is not true, perform actions
									defaults.field_data.call_restriction[k] = {
										friendly_name: v.friendly_name
									};
							
									defaults.data.call_restriction[k] = { action: 'inherit' };
								});
							} 
							
							else {
								
							}

							callback(null, _data_classifiers);

						}
					});
				},
				media_list: function(callback) {

					var mediaFilters = {
						paginate: false
					};
		
					if (miscSettings.hideMailboxMedia) {
						mediaFilters['filter_not_media_source'] = 'recording';
					}

					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId,
							filters: mediaFilters
						},
						success: function(_data, status) {

							var mediaList = _.sortBy(_data.data, function(item) { return item.name.toLowerCase(); });

							if (mediaList) {

								mediaList.unshift(
									{
										id: '',
										name: self.i18n.active().callflows.user.default_music
									},
									{
										id: 'silence_stream://300000',
										name: self.i18n.active().callflows.user.silence
									},
									{
										id: 'shoutcast',
										name: self.i18n.active().callflows.accountSettings.musicOnHold.shoutcastURL
									}
								);

							}

							defaults.field_data.media = mediaList;
							callback(null, _data);
						}
					});
				},
				user_get: function(callback) {
					if (typeof data === 'object' && data.id) {
						self.userGet(data.id, function(_data, status) {
							self.userMigrateData(_data);

							callback(null, _data);
						});
					} else {
						self.random_id = monster.md5(monster.util.randomString(10) + new Date().toString());
						defaults.field_data.new_user = self.random_id;

						callback(null, defaults);
					}
				},
				user_hotdesks: function(callback) {

					if (typeof data === 'object' && data.id) {
						
						if (miscSettings.userShowHotdeskStatus) {

							var filters = { 
								paginate: false,
								with_status: true,
								has_key: 'hotdesk.users.' + data.id
							}
							
							self.callApi({
								resource: 'device.list',
								data: {
									accountId: self.accountId,
									filters: filters
								},
							
								success: function(_data_devices) {
	
									defaults.field_data.hotdesk_enabled = true;
									defaults.field_data.device_list = {};
	
									var deviceList = {};
	
									$.each(_data_devices.data, function(k, v) {
	
										var hotdeskDevice = v,
											deviceName = hotdeskDevice.name,
											deviceMac = hotdeskDevice.mac_address,
											deviceRegistered = hotdeskDevice.registered,
											deviceRegistrable = hotdeskDevice.registrable,
											deviceEnabled = hotdeskDevice.enabled;
										
										deviceList[v.id] = {
											name: deviceName,
											mac_address: deviceMac,
											registered: deviceRegistered,
											registrable: deviceRegistrable,
											enabled: deviceEnabled
										};
		
									});
	
									if (_data_devices.data.length > 0) {
										defaults.field_data.device_list = deviceList;
									} else {
										delete defaults.field_data.device_list;
									}
	
									callback(null, _data_devices);
								},
								error: function(_data, status) {
									//callback({api_name: 'Hotdesk'}, _data);
									callback(null, defaults);
								}
							});

						} else {

							self.callApi({
								resource: 'user.hotdesks',
								data: {
									accountId: self.accountId,
									userId: data.id
								},
								success: function(_data_devices) {
									defaults.field_data.hotdesk_enabled = true;
									defaults.field_data.device_list = {};
	
									$.each(_data_devices.data, function(k, v) {
										defaults.field_data.device_list[v.device_id] = { name: v.device_name };
									});
	
									if ($.isEmptyObject(defaults.field_data.device_list)) {
										delete defaults.field_data.device_list;
									}
	
									callback(null, _data_devices);
								},
								error: function(_data, status) {
									//callback({api_name: 'Hotdesk'}, _data);
									callback(null, defaults);
								}
							});

						}

					} else {
						callback(null, defaults);
					}
					
				}

			});

			if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {

				parallelFunctions.emergencyCallerIdNumbers = function(next) {
					
					var filters = { paginate: false };

					if (miscSettings.restrictEmergencyCallerId911) {
						filters.has_key = 'e911';
					}

					if (miscSettings.restrictEmergencyCallerId999) {
						filters.has_key = 'dimension.uk_999';
					}

					self.callApi({
						resource: 'numbers.listAll',
						data: {
							accountId: self.accountId,
							filters: filters
						},
						success: _.flow(
							_.partial(_.get, _, 'data.numbers'),
							_.partial(_.map, _, function(meta, number) {
								return { number: number };
							}),
							_.partial(_.sortBy, _, 'number'),
							_.partial(next, null)
						),
						error: _.partial(_.ary(next, 2), null, [])
					});
				}
			}

			if (monster.util.getCapability('caller_id.external_numbers').isEnabled) {
				parallelFunctions.cidNumbers = function(next) {
					self.callApi({
						resource: 'externalNumbers.list',
						data: {
							accountId: self.accountId
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.partial(next, null)
						),
						error: _.partial(_.ary(next, 2), null, [])
					});
				};
			}

			monster.parallel(parallelFunctions, function(err, results) {
				var render_data = defaults;
				if (typeof data === 'object' && data.id) {
					if (results.user_get.hasOwnProperty('call_restriction')) {
						$.each(results.user_get.call_restriction, function(k, v) {
							if (defaults.field_data.call_restriction.hasOwnProperty(k)) {
								defaults.field_data.call_restriction[k].action = v.action;
							}
						});
					}

					render_data = $.extend(true, defaults, { data: results.user_get });

					// if the value is set to a stream, we need to set the value of the media_id to shoutcast so it gets selected by the old select mechanism,
					// but we also need to store the  value so we can display it
					if (render_data.data.hasOwnProperty('music_on_hold') && render_data.data.music_on_hold.hasOwnProperty('media_id')) {
						if (render_data.data.music_on_hold.media_id.indexOf('://') >= 0) {
							if (render_data.data.music_on_hold.media_id !== 'silence_stream://300000') {
								render_data.extra.isShoutcast = true;
								render_data.extra.shoutcastValue = render_data.data.music_on_hold.media_id;
								render_data.data.music_on_hold.media_id = 'shoutcast';
							}
						}
					}
				}

				render_data.extra = _.merge({}, render_data.extra, {
					isShoutcast: false
				}, _.pick(results, [
					'cidNumbers',
					'phoneNumbers',
					'emergencyCallerIdNumbers'
				]));

				// get user callflow if callflow id found before
				if (userCallflow != null) {
					self.callApi({
						resource: 'callflow.get',
						data: {
							accountId: self.accountId,
							callflowId: userCallflow.id
						},
						success: function(userCallflow) {
							if (miscSettings.enableConsoleLogging) {
								console.log('User Callflow', userCallflow.data);
							}
							
							defaults.field_data.user_callflow = userCallflow.data;

							if (defaults.field_data.callflow_features.includes("ring_group")) {
								//defaults.field_data.callflow_ring_group = userCallflow.data.flow.data;
								var ringGroupNode = self.userCallflowGetNode({
										callflow: userCallflow.data,
										module: 'ring_group'
									});

								defaults.field_data.callflow_ring_group = ringGroupNode.data;
							}

							self.userRender(render_data, target, callbacks);
							
							if (typeof callbacks.after_render === 'function') {
								callbacks.after_render();
							}
						}
		
					});

				}

				else {
					self.userRender(render_data, target, callbacks);
					
					if (typeof callbacks.after_render === 'function') {
						callbacks.after_render();
					}
				}

			});
		},

		userRender: function(data, target, callbacks) {
			var self = this;

			if (miscSettings.enableConsoleLogging) {
				console.log('User Data', data)
			}

			if (miscSettings.callflowButtonsWithinHeader) {
				self.userSubmoduleButtons(data);
			};

			var self = this,
				cidSelectorsPerTab = {
					basic: [
						'external'
					],
					caller_id: [
						'external',
						'emergency',
						'asserted'
					]
				},
				tabsWithCidSelectors = _.keys(cidSelectorsPerTab),
				selectorsWithReflectedValue = _.spread(_.intersection)(_.map(cidSelectorsPerTab)),
				hasExternalCallerId = monster.util.getCapability('caller_id.external_numbers').isEnabled || miscSettings.enableCallerIdDropdown,
				allowAddingExternalCallerId,
				emergencyCallerIdAlertShown = false;

				if (miscSettings.preventAddingExternalCallerId) {
					allowAddingExternalCallerId = false
				}
				else {
					allowAddingExternalCallerId = true
				}

				var findMeFollowMeEnabled = data?.data?.smartpbx?.find_me_follow_me?.enabled === true,
					userCallflow = data?.field_data?.user_callflow;

				if (userCallflow) {
					var missedCallNode = self.userCallflowHasMissedCallAlert(userCallflow);
					
					data.field_data.user_ring_timeout_current = self.userCallflowGetRingTimeout(userCallflow, findMeFollowMeEnabled);
					data.field_data.user_ring_timeout = data.field_data.user_ring_timeout_current;
					
					if (missedCallNode) {
						data.field_data.missed_call_alert_enabled = !!missedCallNode;
						data.field_data.missed_call_alert_internal = !!(missedCallNode && missedCallNode.alert_on_internal_calls);
						data.field_data.missed_call_alert_email_override = !!self.userCallflowHasMissedCallAlertEmailOverride(userCallflow);
						data.field_data.missed_call_alert_emails = self.userCallflowGetMissedCallAlertEmailRecipients(userCallflow);
					}
				}

				user_html = $(self.getTemplate({
					name: 'edit',
					data: _.merge({
						hideAdd: hideAdd,
						hideClassifiers: hideClassifiers,
						miscSettings: miscSettings,
						hasExternalCallerId: hasExternalCallerId,
						showPAssertedIdentity: monster.config.whitelabel.showPAssertedIdentity,
						data: {
							vm_to_email_enabled: _.get(data, 'data.vm_to_email_enabled', true)
						}
					}, _.pick(data.extra, [
						'phoneNumbers'
					]), data),
					submodule: 'user'
				})),
				user_form = user_html.find('#user-form'),
				hotdesk_pin = $('.hotdesk_pin', user_html),
				hotdesk_pin_require = $('#hotdesk_require_pin', user_html);

			if (miscSettings.readOnlyCallerIdName) {
				user_html.find('.caller-id-external-number').on('change', function(event) {
					phoneNumber = $('.caller-id-external-number select[name="caller_id.external.number"]').val();
					formattedNumber = phoneNumber.replace(/^\+44/, '0');
					$('#advanced_caller_id_name_external', user_html).val(formattedNumber);	
				});
			}

			if (miscSettings.readOnlyCallerIdName) {
				user_html.find('.caller-id-emergency-number').on('change', function(event) {
					phoneNumber = $('.caller-id-emergency-number select[name="caller_id.emergency.number"]').val();
					formattedNumber = phoneNumber.replace(/^\+44/, '0');
					$('#advanced_caller_id_name_emergency', user_html).val(formattedNumber);	
				});
			}

			if (miscSettings.readOnlyCallerIdName) {
				user_html.find('.caller-id-asserted-number').on('change', function(event) {
					phoneNumber = $('.caller-id-asserted-number select[name="caller_id.asserted.number"]').val();
					formattedNumber = phoneNumber.replace(/^\+44/, '0');
					$('#advanced_caller_id_name_asserted', user_html).val(formattedNumber);	
				});
			}

			if (!findMeFollowMeEnabled) {
				user_html.find('.information-text.ring-timeout').hide();
			}

			user_html.find('.ring-timeout').on('change', function(event) {

				if (data.field_data.user_callflow != null) {
					timeoutReset = data.field_data.user_ring_timeout_current
				} else {
					timeoutReset = 30
				}

				ringTimeout = $('#ring_timeout', user_html).val();

				if (ringTimeout < 10 || ringTimeout > 120) {
					$('#ring_timeout', user_html).val(timeoutReset);
					monster.ui.alert('warning', self.i18n.active().callflows.user.ringing_timeout_invalid);
				}

			});
			
			if (hasExternalCallerId) {
				_.forEach(tabsWithCidSelectors, function(tab) {
					_.forEach(cidSelectorsPerTab[tab], function(selector) {

						var $target = user_html.find('#' + tab + ' .caller-id-' + selector + '-target'),
							selectedNumber = _.get(data.data, ['caller_id', selector, 'number']);

						if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
							phoneNumbers = selector === 'emergency' || selector === 'asserted'
								? { phoneNumbers: [...data.extra.emergencyCallerIdNumbers] }
								: _.pick(data.extra, ['cidNumbers', 'phoneNumbers']);
						} else {
							phoneNumbers = _.pick(data.extra, ['cidNumbers', 'phoneNumbers']);
						}

						if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
							if (selectedNumber) {

								var isSelectedInList = _.some(phoneNumbers.phoneNumbers, { number: selectedNumber });

								if (!isSelectedInList) {
									phoneNumbers.phoneNumbers.unshift({
										number: selectedNumber,
										className: 'invalid-number'
									});

									if (miscSettings.enableConsoleLogging) {
										console.log(selectedNumber + ' is set but missing from dropdown, added to ' + selector);
									}
								}
							}
						}

						monster.ui.cidNumberSelector($target, _.merge({

							onAdded: function(numberMetadata) {
								user_html.find('select[name^="caller_id."]').each(function() {
									var $select = $(this),
										hasNumber = $select.find('option[value="' + numberMetadata.number + '"]') > 0;

									if (hasNumber) {
										return;
									}
									$select
										.append($('<option>', {
											value: numberMetadata.number,
											text: monster.util.formatPhoneNumber(numberMetadata.number)
										}))
										.trigger('chosen:updated');
								});

								if (!_.includes(selectorsWithReflectedValue, selector)) {
									return;
								}
								var reflectedTab = tab === 'basic' ? 'caller_id' : 'basic',
									reflectedSelect = '#' + reflectedTab + ' .caller-id-' + selector + '-target select';

								user_html
									.find(reflectedSelect)
									.val(numberMetadata.number)
									.trigger('chosen:updated');
							},
							selectName: 'caller_id.' + selector + '.number',
							selected: _.get(data.data, ['caller_id', selector, 'number']),
							allowAdd: (selector === 'emergency' || selector === 'asserted') && (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999)
								? false
								: allowAddingExternalCallerId
						}, phoneNumbers ));

						if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
							$target.find('select[name="caller_id.' + selector + '.number"]').on('chosen:showing_dropdown chosen:updated', function() {
		
								if (selector === 'emergency' || selector === 'asserted') {
									
									var emergencyNumbersList = _.map(data.extra.emergencyCallerIdNumbers, function(entry) {
										return entry.number.replace(/\s+/g, '');
									});
							
									var $chosenResults = $target.find('.chosen-container .chosen-results li');
							
									$chosenResults.each(function() {
										var $li = $(this),
											liText = $li.text().trim().replace(/\s+/g, '');
							
										if (!/^\+?[0-9]+$/.test(liText)) {
											return;
										}
							
										if (!emergencyNumbersList.includes(liText)) {
											$li.addClass('invalid-number');
											if ($li.find('.fa-exclamation-circle').length === 0) {
												$li.append(' <i class="no-address fa fa-exclamation-triangle" aria-hidden="true"></i> <span class="no-address-text"> No Address Set</span>');
											}
										}
									});
								}
							});
						}
							
					});
				});

				if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
					function invalidEmergencyCallerId() {

						user_html.find('select[name^="caller_id."]').each(function() {
							var $select = $(this),
								selectName = $select.attr('name'),
								selectedValue = $select.val(),
								$chosenSingle = $select.closest('.monster-cid-number-selector-wrapper')
													.find('.chosen-container .chosen-single'),
								emergencyNumbersList = _.map(data.extra.emergencyCallerIdNumbers, function(entry) {
									return entry.number;
								});

							if (selectName.includes('caller_id.emergency') || selectName.includes('caller_id.asserted')) {
							
								if (selectedValue && !emergencyNumbersList.includes(selectedValue)) {
									$chosenSingle.addClass('invalid-number');
									if (!emergencyCallerIdAlertShown) {
										if (miscSettings.checkEmergencyAddress911 && miscSettings.restrictEmergencyCallerId911) {
											monster.ui.alert('warning', self.i18n.active().callflows.e911.emergencyCallerIdAddressNotSet);
										}
										if (miscSettings.checkEmergencyAddress999 && miscSettings.restrictEmergencyCallerId999) {
											monster.ui.alert('warning', self.i18n.active().callflows.uk999.emergencyCallerIdAddressNotSet);
										}
										emergencyCallerIdAlertShown = true;
									}
								} else {
									$chosenSingle.removeClass('invalid-number');
								}

							}
						});

					}

					invalidEmergencyCallerId();

					user_html.find('select[name^="caller_id."]').change(invalidEmergencyCallerId);
				}
				
				_.forEach(selectorsWithReflectedValue, function(type) {
					user_html.find('#basic .caller-id-' + type + '-target select').on('change', function(event) {
						event.preventDefault();

						user_html
							.find('#caller_id .caller-id-' + type + '-target select')
							.val($(this).val())
							.trigger('chosen:updated');
					});
					user_html.find('#caller_id .caller-id-' + type + '-target select').on('change', function(event) {
						event.preventDefault();

						user_html
							.find('#basic .caller-id-' + type + '-target select')
							.val($(this).val())
							.trigger('chosen:updated');
					});
				});
				
			}
			
			self.userRenderNumberList(data, user_html);

			$('#tab_find_me_follow_me', user_html).hide();
			$('#call_routing_manual', user_html).hide();

			// the following is within monster.waterfall so that the device list is rendered before the page loads
			monster.waterfall([
				function(callback) {
					self.userGetDeviceList(data, function(deviceList) {
						data.field_data.device_list = deviceList;
						self.userRenderDeviceList(data, deviceList, user_html, function() {
							callback(null);
						});
					});
				},
				function() {
					target.empty().append(user_html);
					
					var findMeFollowMeEnabled = data?.data?.smartpbx?.find_me_follow_me?.enabled === true,
						userCallflow = data?.field_data?.user_callflow;

					if (findMeFollowMeEnabled && userCallflow) {
						$('#tab_find_me_follow_me', user_html).show();
						//data.field_data.ring_group = userCallflow.flow.data;

						var ringGroupNode = self.userCallflowGetNode({
							callflow: userCallflow,
							module: 'ring_group'
						});

						data.field_data.ring_group = ringGroupNode.data;

						self.usersRenderFindMeFollowMe(data, data.field_data.device_list, user_html);
					}

					// mainUserCallflow modification support
					if (miscSettings.userShowCallRoutingTab && miscSettings.enableModifyMainUserCallflow) {
						var mainUserCallflowModified = data?.data?.dimension?.main_user_callflow_modified === true,
							userCallflow = data?.field_data?.user_callflow;

						// disable edit and reset user callflow button on page load - only allow modification if mainUserCallflowModified is true on user doc
						var $userCallflowButtons = $(user_html).find('#edit_user_callflow, #reset_user_callflow');

						$userCallflowButtons
							.prop('disabled', true)
							.addClass('button-disabled');

						if (mainUserCallflowModified && userCallflow) {

							$('#call_routing_user', user_html).hide();
							$('#call_routing_manual', user_html).show();
							
							$userCallflowButtons
								.prop('disabled', false)
								.removeClass('button-disabled');

							// disable voicemail and find me follow me settings on form if mainUserCallflowModified is true on user doc
							var $userVoicemailSettings = $(user_html).find('#user_voicemail, #ring_timeout, #vm_to_email_enabled');

							$userVoicemailSettings
								.prop('disabled', true)
								.addClass('input-readonly');

							$(user_html).find('#edit_link_vmbox').hide();

							$(user_html).find('#smartpbx\\.find_me_follow_me\\.enabled')
								.prop('disabled', true)
								.addClass('input-readonly');

						}
					}

					// if user the user is logged into a hotdesk device update the table
					if (data.field_data.device_list) {
						self.userRenderHotdeskList(data, user_html);
					}

					monster.ui.validate(user_form, {
						rules: {
							'extra.shoutcastUrl': {
								protocol: true
							},
							username: {
								required: true,
								minlength: 3,
								regex: /^[0-9a-zA-Z+@._-]*$/
							},
							first_name: {
								required: true,
								minlength: 1,
								maxlength: 256,
								regex: /^[0-9a-zA-Z\s\-']+$/
							},
							last_name: {
								required: true,
								minlength: 1,
								maxlength: 256,
								regex: /^[0-9a-zA-Z\s\-']+$/
							},

							email: {
								required: true,
								email: true
							},
							pwd_mngt_pwd1: {
								required: true,
								minlength: 3
							},
							pwd_mngt_pwd2: {
								required: true,
								minlength: 3,
								equalTo: '#pwd_mngt_pwd1'
							},
							'hotdesk.pin': { regex: /^[0-9]*$/ },
							'hotdesk.id': { regex: /^[0-9+#*]*$/ },
							call_forward_number: { regex: /^[+]?[0-9]*$/ },
							'caller_id.internal.name': { maxlength: 30 },
							'caller_id.external.name': { regex: /^[0-9A-Za-z ,]{0,30}$/ },
							'caller_id.emergency.name': { regex: /^[0-9A-Za-z ,]{0,30}$/ },
							'caller_id.asserted.name': { regex: /^[0-9A-Za-z ,]{0,30}$/ },
							'caller_id.internal.number': { regex: /^[+]?[0-9\s\-.()]*$/ },
							'caller_id.external.number': { regex: /^[+]?[0-9\s\-.()]*$/ },
							'caller_id.emergency.number': { regex: /^[+]?[0-9\s\-.()]*$/ },
							'caller_id.asserted.number': { phoneNumber: true },
							'caller_id.asserted.realm': { realm: true }
						},
						messages: {
							username: { regex: self.i18n.active().callflows.user.validation.username },
							first_name: { regex: self.i18n.active().callflows.user.validation.name },
							last_name: { regex: self.i18n.active().callflows.user.validation.name },
							'hotdesk.pin': { regex: self.i18n.active().callflows.user.validation.hotdesk.pin },
							'hotdesk.id': { regex: self.i18n.active().callflows.user.validation.hotdesk.id },
							'caller_id.internal.name': { regex: self.i18n.active().callflows.user.validation.caller_id.name },
							'caller_id.external.name': { regex: self.i18n.active().callflows.user.validation.caller_id.name },
							'caller_id.emergency.name': { regex: self.i18n.active().callflows.user.validation.caller_id.name },
							'caller_id.asserted.name': { regex: self.i18n.active().callflows.user.validation.caller_id.name },
							'caller_id.internal.number': { regex: self.i18n.active().callflows.user.validation.caller_id.number },
							'caller_id.external.number': { regex: self.i18n.active().callflows.user.validation.caller_id.number },
							'caller_id.emergency.number': { regex: self.i18n.active().callflows.user.validation.caller_id.number },
							'caller_id.asserted.number': { regex: self.i18n.active().callflows.user.validation.caller_id.number },
							'caller_id.asserted.realm': { regex: self.i18n.active().callflows.user.validation.caller_id.realm }
						}
					});

					timezone.populateDropdown(
						$('#timezone', user_html),
						_.get(data.data, 'timezone', 'inherit'),
						{
							inherit: self.i18n.active().defaultTimezone
						}
					);

					user_html.find('input[data-mask]').each(function() {
						var $this = $(this);
						monster.ui.mask($this, $this.data('mask'));
					});

					if (data.data.id === monster.apps.auth.userId) {
						$('.user-delete', user_html).hide();
					}

					$('*[rel=popover]:not([type="text"])', user_html).popover({
						trigger: 'hover'
					});

					$('*[rel=popover][type="text"]', user_html).popover({
						trigger: 'focus'
					});

					$('.add-phone-number', user_html).click(function(ev) {

						ev.preventDefault();

						var field_data = data.field_data;

						self.listNumbers(function(phoneNumbers) {
							var parsedNumbers = [];

							// filter out numbers already added to the form but not yet saved
							_.each(phoneNumbers, function(number) {
								if ($.inArray(number.phoneNumber, field_data.phone_numbers) < 0) {	
									parsedNumbers.push(number);
								}
							});

							var popup_html = $(self.getTemplate({
									name: 'addPhoneNumber',
									data: {
										phoneNumbers: parsedNumbers,
										hideBuyNumbers: _.get(monster, 'config.whitelabel.hideBuyNumbers', false)
									},
									submodule: 'user'
								})),
								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.add_number
								});

							if (parsedNumbers.length == 0) {
								popup_html.find('.add_number').addClass('disabled').attr('disabled', 'disabled');
							}

							monster.ui.chosen(popup_html.find('#list_numbers'), {
								width: '160px'
							});

							// Have to do that so that the chosen dropdown isn't hidden.
							popup_html.parent().css('overflow', 'visible');

							if (parsedNumbers.length === 0) {
								$('#list_numbers', popup_html).attr('disabled', 'disabled');
								$('<option value="select_none">' + self.i18n.active().oldCallflows.no_phone_numbers + '</option>').appendTo($('#list_numbers', popup_html));
							}

							popup.find('.buy-link').on('click', function(e) {
								e.preventDefault();
								monster.pub('common.buyNumbers', {
									searchType: $(this).data('type'),
									callbacks: {
										success: function(numbers) {
											var lastNumber;

											_.each(numbers, function(number, k) {
												popup.find('#list_numbers').append($('<option value="' + k + '">' + monster.util.formatPhoneNumber(k) + '</option>'));
												lastNumber = k;
											});

											popup.find('#list_numbers').val(lastNumber).trigger('chosen:updated');
										}
									}
								});
							});

							$('.add_number', popup).click(function(event) {
								
								event.preventDefault();
							
								var number = $('input[name="number_type"]:checked', popup).val() === 'your_numbers' ? $('#list_numbers option:selected', popup).val() : $('#add_number_text', popup).val();
							
								// push number into field_data.numbers
								field_data.phone_numbers.push(number);

								if (miscSettings.enableConsoleLogging) {
									console.log('Number Being Added:', number)
								}

								self.userRenderNumberList(data, user_html)
							
								popup.dialog('close');

							});

						});
					});

					self.winkstartTabs(user_html);
					self.winkstartLinkForm(user_html);

					hotdesk_pin_require.is(':checked') ? hotdesk_pin.show() : hotdesk_pin.hide();

					if (!$('#music_on_hold_media_id', user_html).val()) {
						$('#edit_link_media', user_html).hide();
					}

					self.userBindEvents({
						template: user_html,
						userForm: user_form,
						hotdeskPin: hotdesk_pin,
						hotdeskPinRequire: hotdesk_pin_require,
						data: data,
						callbacks: callbacks
					});
				}
			]);
		},

		/**
		 * Bind events for the user edit template
		 * @param  {Object} args
		 * @param  {jQuery} args.template
		 * @param  {jQuery} args.userForm
		 * @param  {jQuery} args.hotdeskPin
		 * @param  {jQuery} args.hotdeskPinRequire
		 * @param  {Object} args.data
		 * @param  {Object} args.callbacks
		 * @param  {Function} args.callbacks.save_success
		 * @param  {Function} args.callbacks.save_error
		 * @param  {Function} args.callbacks.delete_success
		 * @param  {Function} args.callbacks.delete_error
		 */
		userBindEvents: function(args) {
			var self = this,
				user_html = args.template,
				user_form = args.userForm,
				hotdesk_pin = args.hotdeskPin,
				hotdesk_pin_require = args.hotdeskPinRequire,
				data = args.data,
				callbacks = args.callbacks,
				data_devices;

			hotdesk_pin_require.change(function() {
				$(this).is(':checked') ? hotdesk_pin.show('blind') : hotdesk_pin.hide('blind');
			});

			$('.user-impersonate', user_html).click(function(ev) {
				monster.pub('auth.triggerImpersonateUser', {
					userId: data.data.id,
					userName: data.data.first_name + ' ' + data.data.last_name
				});
			});
				
			$('.user-save', user_html).click(function(ev) {
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

					if (monster.ui.valid(user_form)) {
						var form_data = monster.ui.getFormData('user-form'),
							field_data = data.field_data,
							callflowNumbers = data.field_data.callflow_numbers,
							formNumbers = (data.field_data.extension_numbers || []).concat(form_data.phone_numbers || []),
							userCallflow = data.field_data.user_callflow,
							userVoicemail = form_data.user_voicemail,
							currentRingTimeout = data.field_data.user_ring_timeout_current,
							ringTimeout = parseInt(form_data.ring_timeout, 10),
							findMeFollowMeEnabled = data?.data?.smartpbx?.find_me_follow_me?.enabled === true,
							findMeFollowMe = form_data.smartpbx.find_me_follow_me.enabled === "true",
							callflowRingGroup = data.field_data.callflow_ring_group,
							ringGroup = data.field_data.ring_group,
							mainUserCallflowReset = false,
							missedCallAlertEnabled = $('#missed_call_alert_enabled', user_html).is(':checked'),
							missedCallAlertInternalEnabled = $('#missed_call_alert_internal', user_html).is(':checked'),
							missedCallAlertOverrideEmail = $('#missed_call_alert_email_override', user_html).is(':checked'),
							missedCallAlertEmailEditor = data.field_data.missed_call_email_editor;

						if (miscSettings.userShowCallRoutingTab && miscSettings.enableModifyMainUserCallflow) {
							var dataMainUserCallflowModified = data?.data?.dimension?.main_user_callflow_modified === true,
								formMainUserCallflowModified = form_data.dimension.main_user_callflow_modified === "true";
						}

						// show warning message opposed to error if find me follow me is enabled but no devices are set to ring
						if (findMeFollowMe) {
							var endpoints = Array.isArray(ringGroup && ringGroup.endpoints) ? ringGroup.endpoints : [];
							if (endpoints.length === 0) {
								monster.ui.alert('warning', self.i18n.active().callflows.user.find_me_follow_me.can_not_save);
								return
							}
						}

						// show warning message opposed to error if missed call alert is enabled with email override but not emails are set
						if (missedCallAlertOverrideEmail) {
							var emails = missedCallAlertEmailEditor ? missedCallAlertEmailEditor.getValues() : [];
							if (!emails.length) {
								monster.ui.alert('warning', self.i18n.active().callflows.user.missed_call_alert.no_override_recipients);
								return;
							}
						}

						function continueSave() {

							if (miscSettings.enableConsoleLogging) {
								console.log('Numbers on User Callflow', callflowNumbers);
								console.log('Numbers on User Form', formNumbers);
							}

							if ('callflow_numbers' in form_data) {
								delete form_data.callflow_numbers;
							}

							if ('phone_numbers' in form_data) {
								delete form_data.phone_numbers;
							}

							if ('extension_numbers' in form_data) {
								delete form_data.extension_numbers;
							}

							if ('user_voicemail' in form_data) {
								delete form_data.user_voicemail;
							}

							if ('ring_timeout' in form_data) {
								delete form_data.ring_timeout;
							}

							if (form_data.enable_pin === false) {
								delete data.data.queue_pin;
								delete data.data.record_call;
							}

							if (form_data.music_on_hold.media_id === 'shoutcast') {
								form_data.music_on_hold.media_id = user_html.find('.shoutcast-url-input').val();
							}

							self.userCleanFormData(form_data);

							if ('field_data' in data) {
								delete data.field_data;
							}

							monster.waterfall([

								function(callback) {

									if (!userCallflow || !userCallflow.flow) {
										return callback(null);
									}

									var missedCallData = self.userCallflowHasMissedCallAlert(userCallflow);

									// build recipients list
									function buildRecipients() {
										if (!missedCallAlertOverrideEmail) {
											return [
												{ 
													type: 'user', 
													id: userCallflow.owner_id 
												}
											];
										}

										var emails = (missedCallAlertEmailEditor.getValues());

										return _.map(emails, function(e) {
											return { 
												type: 'email', 
												id: e 
											};
										});
									}

									// disable missed call alert
									if (!missedCallAlertEnabled) {
										if (!missedCallData) {
											return callback(null);
										}

										self.userCallflowDisableMissedCallAlert(userCallflow);

										return self.userUpdateCallflow(userCallflow, callback, function() {
											callback(null);
										});
									}

									// enable missed call alert
									if (!missedCallData) {
										self.userCallflowEnableMissedCallAlert(userCallflow, {
											alert_on_internal_calls: !!missedCallAlertInternalEnabled
										});

										missedCallData = self.userCallflowHasMissedCallAlert(userCallflow);
									}

									// update recipients and alert on internal calls
									var recipients = buildRecipients();
									
									if (recipients === null) {
										return callback(null);
									}

									missedCallData.alert_on_internal_calls = !!missedCallAlertInternalEnabled;
									missedCallData.recipients = recipients;

									return self.userUpdateCallflow(userCallflow, callback, function() {
										callback(null);
									});
								},

								function(callback) {
									
									if (miscSettings.enableConsoleLogging) {
										console.log('Find Me Follow Me Enabled:', findMeFollowMe);
										console.log('callflowRingGroup', callflowRingGroup);
										console.log('ringGroup', ringGroup);
									}

									var updateUserCallflow = false,
										callflowNode = {};

									// disable find me follow me if currently enabled and routing type is being set to manually configured
									if (formMainUserCallflowModified && findMeFollowMe) {
										findMeFollowMe = false;
										form_data.smartpbx.find_me_follow_me.enabled = false;
									}
									
									// check if find me follow me is enabled
									if (findMeFollowMe == true) {
										
										// function to compare callflowRingGroup and ringGroup
										function areRingGroupsEqual(group1, group2) {
											if (
												group1.timeout !== group2.timeout ||
												group1.strategy !== group2.strategy ||
												group1.repeats !== group2.repeats ||
												group1.ignore_forward !== group2.ignore_forward
											) {
												return false;
											}
										
											// check if both have an endpoints array with the same length
											if (!Array.isArray(group1.endpoints) || !Array.isArray(group2.endpoints) ||
												group1.endpoints.length !== group2.endpoints.length) {
												return false;
											}
										
											// sort the endpoints arrays by id for a consistent comparison
											const sortedEndpoints1 = [...group1.endpoints].sort((a, b) => a.id.localeCompare(b.id));
											const sortedEndpoints2 = [...group2.endpoints].sort((a, b) => a.id.localeCompare(b.id));
										
											return sortedEndpoints1.every((endpoint1, index) => {
												const endpoint2 = sortedEndpoints2[index];
												return (
													endpoint1.id === endpoint2.id &&
													endpoint1.endpoint_type === endpoint2.endpoint_type &&
													endpoint1.delay === endpoint2.delay &&
													endpoint1.timeout === endpoint2.timeout
												);
											});
										}

										// check if find me follow me is currently enabled
										if (findMeFollowMeEnabled == true) {
											// check if there are differences between the existing ring group and what is on the form
											if (!areRingGroupsEqual(callflowRingGroup, ringGroup)) {
												// update user callflow
												updateUserCallflow = true;
												
												callflowNode.module = 'ring_group';
												callflowNode.data = {
													strategy: 'simultaneous',
													timeout: ringGroup.timeout,
													repeats: 1,
													ignore_forward: true,
													endpoints: ringGroup.endpoints											
												};
												callback(null, updateUserCallflow, callflowNode);
											} else {
												callback(null, updateUserCallflow, callflowNode);
											}
										} else {
											// update user callflow
											updateUserCallflow = true;
												
											callflowNode.module = 'ring_group';
											callflowNode.data = {
												strategy: 'simultaneous',
												timeout: ringGroup.timeout,
												repeats: 1,
												ignore_forward: true,
												endpoints: ringGroup.endpoints
											};
											callback(null, updateUserCallflow, callflowNode);
										}
									} else {
										// check if find me follow me state has been changed
										if (findMeFollowMeEnabled != findMeFollowMe) {
											// update user callflow
											updateUserCallflow = true;

											// set used module on callflow
											callflowNode.module = 'user';
											callflowNode.data = {
												can_call_self: false,
												id: data.data.id,
												timeout: ringTimeout,
												delay: 0,
												strategy: "simultaneous"
											};
											callback(null, updateUserCallflow, callflowNode);
										} else {
											callback(null, updateUserCallflow, callflowNode);
										}
									}

								},

								function(updateUserCallflow, callflowNode, callback) {

									// does the users callflow needs to be updated it
									if (updateUserCallflow) {
										// update the flow section of the users callflow
										var flow = userCallflow.flow;
										while (flow.hasOwnProperty('module') && ['ring_group', 'user'].indexOf(flow.module) < 0) {
											flow = flow.children._;
										}
										flow.module = callflowNode.module;
										flow.data = callflowNode.data;

										self.userUpdateCallflow(userCallflow, callback, function() {
											callback(null);
										});
									} else {
										callback(null);
									}

								},
					
								function(callback) {
									// voicemail update function - do this after updating find me follow me
									if (userCallflow != null) {

										var voicemailFormValue,
											voicemailEnabled;
			
										if (userVoicemail == 'enabled') {
											voicemailFormValue = true
										} else {
											voicemailFormValue = false
										}
			
										if (field_data.callflow_features.includes('voicemail')) {
											voicemailEnabled = true
										} else {
											voicemailEnabled = false
										}

										// skip mainUserCallflow is being reset
										if (!mainUserCallflowReset) {

											var ringTimeoutChanged = ringTimeout !== currentRingTimeout,
												voicemailChanged = voicemailEnabled != voicemailFormValue;

											if (voicemailChanged || (findMeFollowMe == false && ringTimeoutChanged)) {

												if (miscSettings.enableConsoleLogging) {
													console.log('Updating Voicemail/Timeout:', {
														voicemailChanged: voicemailChanged,
														ringTimeoutChanged: ringTimeoutChanged,
														ringTimeout: ringTimeout,
														currentRingTimeout: currentRingTimeout
													});
												}
												
												// updates voicemail skip_module (if needed) and sets timeout on the user node
												self.usersUpdateVMBoxStatusInCallflow({
													callflow: userCallflow,
													enabled: voicemailFormValue,
													ringTimeout: ringTimeout
												}, callback);

											} else {
												callback(null);
											}

										} else {
											callback(null);
										}

									} else {
										callback(null)
									}

								},

								function(callback) {
									// patch users callflow if there is a change to the qty of numbers
									if (userCallflow != null && formNumbers.length > 0 && formNumbers.length != callflowNumbers.length) {
										self.callApi({
											resource: 'callflow.patch',
											data: {
												accountId: self.accountId,
												callflowId: userCallflow.id,
												data: {
													numbers: formNumbers,
													ui_metadata: {
														origin: 'voip'
													}
												},
												removeMetadataAPI: true
											},
											success: function(_callflow_update) {
												if (miscSettings.enableConsoleLogging) {
													console.log('User Callflow Updated', _callflow_update)
												}
												callback(null);
											}
										})
									} else {
										callback(null);
									}

								},

								function() {
									self.callApi({
										resource: 'account.get',
										data: {
											accountId: self.accountId
										},
										success: function(_data, status) {
											if (form_data.priv_level === 'admin') {
												form_data.apps = form_data.apps || {};
												if (!('voip' in form_data.apps) && $.inArray('voip', (_data.data.available_apps || [])) > -1) {
													form_data.apps.voip = {
														label: self.i18n.active().callflows.user.voip_services_label,
														icon: 'device',
														api_url: monster.config.api.default
													};
												}
											} else if (form_data.priv_level === 'user' && $.inArray('userportal', (_data.data.available_apps || [])) > -1) {
												form_data.apps = form_data.apps || {};
												if (!('userportal' in form_data.apps)) {
													form_data.apps.userportal = {
														label: self.i18n.active().callflows.user.user_portal_label,
														icon: 'userportal',
														api_url: monster.config.api.default
													};
												}
											}
			
											self.userSave(form_data, data, function(data, status, action) {
												if (action === 'create') {
													self.userAcquireDevice(data, function() {
														if (typeof callbacks.save_success === 'function') {
															callbacks.save_success(data, status, action);
														}
													}, function() {
														if (typeof callbacks.save_error === 'function') {
															callbacks.save_error(data, status, action);
														}
													});
												} else {
													if (typeof callbacks.save_success === 'function') {
														callbacks.save_success(data, status, action);
													}
												}
											}, function() {
												$this.removeClass('disabled');
											});
										}
									});

								}

							],);
						}

						if (miscSettings.userShowCallRoutingTab && miscSettings.enableModifyMainUserCallflow) {
							// routing type changed from manually configured to user based on form - show confirm dialog
							if (dataMainUserCallflowModified && !formMainUserCallflowModified) {
								monster.ui.confirm(self.i18n.active().callflows.user.call_routing.disable_warning, function() {
									self.resetUserCallflow(data, function() {
										mainUserCallflowReset = true;
										continueSave();
									});
								});
								return;
							}
						}

						continueSave();

					} else {
						$this.removeClass('disabled');
						monster.ui.alert(self.i18n.active().callflows.user.there_were_errors_on_the_form);
					}
				}
			}
			
			$('.user-delete', user_html).click(function(ev) {
				deleteButtonEvents(ev);
			});

			$('#submodule-buttons-container .delete').click(function(ev) {
				deleteButtonEvents(ev);
			});

			function deleteButtonEvents(ev) {	
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.user.are_you_sure_you_want_to_delete, function() {
					self.userDelete(data.data.id, callbacks.delete_success, callbacks.delete_error);
				});
			}

			$('#music_on_hold_media_id', user_html).change(function() {
				!$('#music_on_hold_media_id option:selected', user_html).val() ? $('#edit_link_media', user_html).hide() : $('#edit_link_media', user_html).show();

				user_html.find('.shoutcast-div').toggleClass('active', $(this).val() === 'shoutcast');
			});

			$('.inline_action_vmbox', user_html).click(function(ev) {
				var flow = self.userCallflowGetNode({
					callflow: data.field_data.user_callflow,
					module: 'voicemail'
					})
					
				if (flow == null) {
					monster.ui.alert('warning', self.i18n.active().callflows.user.voicemail_no_mailbox);
				} else {
					var	_data = ($(this).data('action') === 'edit') ? { id: flow.data.id } : {};

					ev.preventDefault();
					monster.pub('callflows.vmbox.editPopup', {
						data: _data,
						callback: function() {}		
					});
				}

			});

			$('.inline_action_media', user_html).click(function(ev) {
				var _data = ($(this).data('action') === 'edit') ? { id: $('#music_on_hold_media_id', user_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();
				monster.pub('callflows.media.editPopup', {
					data: _data,
					callback: function(media) {
						/* Create */
						if (!_id) {
							$('#music_on_hold_media_id', user_html).append('<option id="' + media.id + '" value="' + media.id + '">' + media.name + '</option>');
							$('#music_on_hold_media_id', user_html).val(media.id);

							$('#edit_link_media', user_html).show();
						} else {
							/* Update */
							if (media.hasOwnProperty('id')) {
								$('#music_on_hold_media_id #' + media.id, user_html).text(media.name);
							/* Delete */
							} else {
								$('#music_on_hold_media_id #' + _id, user_html).remove();
								$('#edit_link_media', user_html).hide();
							}
						}
					}
				});
			});

			// add search to dropdown
			user_html.find('#timezone').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			// add search to dropdown
			user_html.find('#music_on_hold_media_id').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			user_html.find('#pwd_mngt_pwd1').on('keyup', function(event) {
				event.preventDefault();
				user_html.find('#was_password_updated').prop('checked', 'checked');
				user_html.find('#pwd_mngt_pwd2').val('');
			});

			$(user_html).delegate('#tab_devices .enabled_checkbox', 'click', function() {
				self.userUpdateSingleDevice($(this), user_html);
			});

			// store initial ring group
			const initialCallflowRingGroup = data.field_data.callflow_ring_group
				? JSON.parse(JSON.stringify(data.field_data.callflow_ring_group))
				: null;

			data.field_data.callflow_ring_group = initialCallflowRingGroup;

			$(user_html).delegate('#tab_find_me_follow_me .enabled_checkbox', 'click', function() {

				var checkbox = $(this),
					row = checkbox.closest('.row'),
					deviceId = row.attr('id'),
					sliderContainer = row.find('.column.third');

				if (checkbox.is(':checked')) {

					// Ensure ring_group and endpoints are initialized
					data.field_data.ring_group = data.field_data.ring_group || {};
					data.field_data.ring_group.endpoints = data.field_data.ring_group.endpoints || [];

					// Add device to ringGroup.endpoints if it doesn't already exist
					var existingEndpoint = data.field_data.ring_group.endpoints.find(endpoint => endpoint.id === deviceId);

					if (!existingEndpoint) {
						// Default delay and timeout values
						let newEndpoint = {
							id: deviceId,
							endpoint_type: "device",
							delay: 0,
							timeout: 120
						};
						data.field_data.ring_group.endpoints.push(newEndpoint);
					}

					self.addFindMeFollowMeSlider(data, deviceId, sliderContainer);

				} else {
					sliderContainer.find('.slider').remove();
					$(`#delay_value_${deviceId}`).text('');
					$(`#timeout_value_${deviceId}`).text('');

					// Remove device from ringGroup.endpoints
					data.field_data.ring_group.endpoints = data.field_data.ring_group.endpoints.filter(endpoint => endpoint.id !== deviceId);

					// Function to calculate the maximum delay + timeout across all endpoints
					const getMaxDelayTimeoutSum = (endpoints) => {
						return endpoints.reduce((maxSum, ep) => {
							const currentSum = ep.delay + ep.timeout;
							return currentSum > maxSum ? currentSum : maxSum;
						}, 0);
					};

					// Get the maximum delay + timeout sum
					const maxDelayTimeoutSum = getMaxDelayTimeoutSum(data.field_data.ring_group.endpoints);

					data.field_data.ring_group.timeout = maxDelayTimeoutSum;

				}

			});

			function missedCallAlertState() {

				var missedCallAlertEnabled  = user_html.find('#missed_call_alert_enabled'),
					missedCallInternal = user_html.find('#missed_call_alert_internal'),
					enabled = missedCallAlertEnabled.is(':checked'),
					overrideEmail = user_html.find('#missed_call_alert_email_override');

				if (!enabled) {
					missedCallInternal.prop('disabled', true).toggleClass('input-readonly', true);
					missedCallInternal.prop('checked', false);
					overrideEmail.prop('disabled', true).toggleClass('input-readonly', true);
					overrideEmail.prop('checked', false);
					$('.list-editor-input', user_html).val('');
					$('#missed_call_email_override_section', user_html).hide();
					$('.list-editor-error', user_html).hide();
				} else {
					missedCallInternal.prop('disabled', false).toggleClass('input-readonly', false);
					overrideEmail.prop('disabled', false).toggleClass('input-readonly', false);
				}

			}

			missedCallAlertState();

			$('#missed_call_alert_enabled', user_html).on('change', missedCallAlertState);

			function missedCallAlertOverrideEmail() {

				var overrideEmail = user_html.find('#missed_call_alert_email_override'),
					enabled = overrideEmail.is(':checked');
					
				if (!enabled) {
					$('.list-editor-input', user_html).val('');
					$('#missed_call_email_override_section', user_html).hide();
					$('.list-editor-error', user_html).hide();
				} else {
					$('#missed_call_email_override_section', user_html).show();
				}

			}

			missedCallAlertOverrideEmail()

			$('#missed_call_alert_email_override', user_html).on('change', missedCallAlertOverrideEmail);

			var $missedCallAlertEmailOverride = user_html.find('#missed_call_email_override_section');

			var listEditorHtml = $(self.getTemplate({
				name: 'listEditor',
				data: {
					title: self.i18n.active().callflows.user.missed_call_alert.recipients,
					addLabel: self.i18n.active().callflows.user.missed_call_alert.add_email,
					placeholder: 'name@example.com'
				}
			}));

			$missedCallAlertEmailOverride.append(listEditorHtml);

			var emailEditor = self.listEditorBind({
				container: listEditorHtml,
				initial: data.field_data.missed_call_alert_emails || [],
				valueType: 'emailAddress',
				getItemHtml: function(value) {
					return $(self.getTemplate({
					name: 'listEditorItem',
					data: {
						value: value,
						miscSettings: miscSettings
					}
					}));
				},
				normalize: function(v) {
					return (v || '').trim().toLowerCase();
				},
				invalidMessage: self.i18n.active().callflows.user.missed_call_alert.invalid_email
			});

			data.field_data.missed_call_email_editor = emailEditor;

			var findMeFollowMeEnabled = data?.data?.smartpbx?.find_me_follow_me?.enabled === true;
			const $ringTimeoutInput = $(user_html).find('#ring_timeout');

			if (findMeFollowMeEnabled) {
				$ringTimeoutInput.prop('disabled', true);
        		$ringTimeoutInput.addClass('input-readonly');
			}

			user_html.find('.smart-pbx-find-me-follow-me').on('change', function(event) {
				var state = $('.smart-pbx-find-me-follow-me select[name="smartpbx.find_me_follow_me.enabled"]').val();

				if (state == 'true') {					
					self.userGetDeviceList(data, function(callback) {
						var deviceList = callback,
							userCallflow = data?.field_data?.user_callflow;

						self.userRenderDeviceList(data, deviceList, user_html);
		
						if (userCallflow) {
							$('#tab_find_me_follow_me', user_html).show(); // show find me follow me table
							
							var ringGroupNode = self.userCallflowGetNode({
								callflow: userCallflow,
								module: 'ring_group'
							});

							data.field_data.ring_group = ringGroupNode
								? ringGroupNode.data
								: {
									strategy: 'simultaneous',
									timeout: 30,
									repeats: 1,
									ignore_forward: true,
									endpoints: []
								};

							//data.field_data.ring_group = userCallflow.flow.data;

							self.usersRenderFindMeFollowMe(data, deviceList, user_html);
						}
					});
					$ringTimeoutInput.prop('disabled', true);
        			$ringTimeoutInput.addClass('input-readonly');
					user_html.find('.information-text.ring-timeout').show();
				} else {
					$('#tab_find_me_follow_me', user_html).hide();
					$ringTimeoutInput.prop('disabled', false);
        			$ringTimeoutInput.removeClass('input-readonly');
					user_html.find('.information-text.ring-timeout').hide();
				}
			});

			user_html.find('.modify-main-user-callflow').on('change', function() {
				var state = $('.modify-main-user-callflow select[name="dimension.main_user_callflow_modified"]').val(),
					dataMainUserCallflowModified = data?.data?.dimension?.main_user_callflow_modified === true;

				if (state == 'true') {	
					$('#call_routing_user', user_html).hide();
					$('#call_routing_manual', user_html).show();
				} else {
					$('#call_routing_user', user_html).show();
					$('#call_routing_manual', user_html).hide();

					if (dataMainUserCallflowModified) {
						$('#ring_timeout', user_html).val(20);
					}
				}
			});

			$('.edit-user-callflow', user_html).click(function(ev) {

				ev.preventDefault();

				// check if user callflow exists
				var userCallflow = data.field_data && data.field_data.user_callflow;

				if (!userCallflow) {
					monster.ui.alert('warning', self.i18n.active().oldCallflows.this_callflow_has_not_been_created);
					return;
				}

				var callflowId = userCallflow.id;

				// load mainUserCallflow editor popup
				monster.pub('callflows.callflow.popupEdit', {
					data: { id: callflowId }
				});

			});

			$('.reset-user-callflow', user_html).click(function(ev) {

				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.user.user_callflow.confirm_reset, function() {

					// check if user callflow exists
					var userCallflow = data.field_data && data.field_data.user_callflow;

					if (!userCallflow) {
						monster.ui.alert('warning', self.i18n.active().oldCallflows.this_callflow_has_not_been_created);
						return;
					}

					self.resetUserCallflow(data, function() {

					});

				});

			});

			$(user_html).delegate('.action_device.edit', 'click', function() {
				var data_device = {
					id: $(this).data('id'),
					hide_owner: !data.data.id ? true : false
				};

				var defaults = {};

				if (!data.data.id) {
					defaults.new_user = self.random_id;
				} else {
					defaults.owner_id = data.data.id;
				}

				monster.pub('callflows.device.popupEdit', {
					data: data_device,
					callback: function(_data) {
						/*
						data_devices = {
							data: { },
							field_data: {
								device_types: data.field_data.device_types
							}
						};
						data_devices.data = _data.data.new_user ? { new_user: true, id: self.random_id } : { id: data.data.id };
						*/

						self.userGetDeviceList(data, function(callback) {
							var deviceList = callback;
							self.userRenderDeviceList(data, deviceList, user_html);
						});
					},
					data_defaults: defaults
				});
			});

			$(user_html).delegate('.action_device.delete', 'click', function() {
				var device_id = $(this).data('id');
				monster.ui.confirm(self.i18n.active().callflows.user.do_you_really_want_to_delete, function() {
					self.userDeleteDevice(device_id, function() {
						/*
						data_devices = {
							data: { },
							field_data: {
								device_types: data.field_data.device_types
							}
						};
						data_devices.data = self.random_id ? { new_user: true, id: self.random_id } : { id: data.data.id };
						*/

						self.userGetDeviceList(data, function(callback) {
							var deviceList = callback;
							self.userRenderDeviceList(data, deviceList, user_html);
						});
					});
				});
			});

			$('.add_device', user_html).click(function(ev) {
				var data_device = {
						hide_owner: true
					},
					defaults = {};

				ev.preventDefault();

				if (!data.data.id) {
					defaults.new_user = self.random_id;
				} else {
					defaults.owner_id = data.data.id;
				}

				monster.pub('callflows.device.popupEdit', {
					data: data_device,
					callback: function(_data) {
						/*
						var data_devices = {
							data: { },
							field_data: {
								device_types: data.field_data.device_types
							}
						};
						data_devices.data = self.random_id ? { new_user: true, id: self.random_id } : { id: data.data.id };
						*/

						self.userGetDeviceList(data, function(callback) {
							var deviceList = callback;
							self.userRenderDeviceList(data, deviceList, user_html);
						});
					},
					data_defaults: defaults
				});
			});
		},

		userRenderList: function(parent, callback) {
			var self = this;

			self.userList(function(data, status) {
				var map_crossbar_data = function(data) {
					var new_list = [];

					if (data.length > 0) {
						$.each(data, function(key, val) {
							new_list.push({
								id: val.id,
								title: (val.first_name && val.last_name) ? val.last_name + ', ' + val.first_name : '(no name)'
							});
						});
					}

					new_list.sort(function(a, b) {
						return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
					});

					return new_list;
				};

				// $('#user-listpanel', parent)
				// 	.empty()
				// 	.listpanel({
				// 		label: _t('user', 'users_label'),
				// 		identifier: 'user-listview',
				// 		new_entity_label: _t('user', 'add_user_label'),
				// 		data: map_crossbar_data(data.data),
				// 		publisher: monster.pub,
				// 		notifyMethod: 'callflows.user.edit',
				// 		notifyCreateMethod: 'callflows.user.edit',
				// 		notifyParent: parent
				// 	});

				callback && callback();
			});
		},

		userRenderNumberList: function(data, parent) {
			var self = this,
				parent = $('#phone_numbers_container', parent);

				if (miscSettings.enableConsoleLogging) {
					console.log('User Data', data)
				}

				var phone_numbers = data.field_data.phone_numbers

				$('.numberRows', parent).empty();

				var numberRow_html = $(self.getTemplate({
					name: 'numberRow',
					data: {
						phone_numbers
					},
					submodule: 'user'
				}));

				$('.numberRows', parent).append(numberRow_html);

				$('.unassign-phone-number', numberRow_html).click(function(ev) {

					ev.preventDefault();
	
					// find the hidden input field within the same .number-container
					var phoneNumberValue = $(this).closest('.number-container').find('input[type="hidden"]').val(),
						field_data = data.field_data;
					
					// remove the phone number from the field data array
					field_data.phone_numbers = field_data.phone_numbers.filter(function(number) {
						return number !== phoneNumberValue;
					});
	
					var row = $(this).closest('.item-row'),
						hr = row.next('hr');
	
					// slide up and remove the item row and the <hr> element
					row.add(hr).slideUp(function() {
						row.add(hr).remove();
					});
	
					if (miscSettings.enableConsoleLogging) {
						console.log('Phone Number Being Removed:', phoneNumberValue);
						console.log('Field Data', field_data);
					}
					
				})
				
		},

		userGetDeviceList: function(data, callback) {
			var self = this,
				filters = { 
					paginate: false,
					with_status: true,
					filter_owner_id: data.data.id
				}
		
			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: filters
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});

		},

		userRenderDeviceList: function(data, deviceList, parent, callback) {
			var self = this,
				parent = $('#tab_devices', parent),
				_data = deviceList;
							
			$('.rows', parent).empty();
			if (_data.length > 0) {

				$.each(_data, function(k, v) {
					v.display_type = data.field_data.device_types[v.device_type];
					v.not_enabled = this.enabled === false ? true : false;
		
					$('.rows', parent)
						.append($(self.getTemplate({
							name: 'deviceRow',
							data: {
								...v,
								miscSettings: miscSettings
							},
							submodule: 'user'
						})));

					$('#' + v.id + ' .column.third', parent).removeClass('device-registered');
					$('#' + v.id + ' .column.third', parent).removeClass('device-offline');
					$('#' + v.id + ' .column.third', parent).removeClass('device-enabled');
					$('#' + v.id + ' .column.third', parent).removeClass('device-disabled');

					// Set 'Online' or 'Offline' based on the 'registered' status
					if (!v.enabled) {
						$('#' + v.id + ' .column.third', parent).text('Disabled');
						$('#' + v.id + ' .column.third', parent).addClass('device-disabled');
					}

					else if (v.enabled && !v.registrable) {
						$('#' + v.id + ' .column.third', parent).text('Enabled');
						$('#' + v.id + ' .column.third', parent).addClass('device-enabled');
					}
					
					else if (v.enabled && v.registrable && v.registered) {
						$('#' + v.id + ' .column.third', parent).text('Registered');
						$('#' + v.id + ' .column.third', parent).addClass('device-registered');
					}

					else {
						$('#' + v.id + ' .column.third', parent).text('Offline');
						$('#' + v.id + ' .column.third', parent).addClass('device-offline');
					}

				});
			} else {
				$('.rows', parent)
					.append($(self.getTemplate({
						name: 'deviceRow',
						submodule: 'user'
					})));
			}

			if (typeof callback === 'function') {
				callback();
			}
			
		},

		userRenderHotdeskList: function(data, parent) {
			var self = this,
				parent = $('#hotdesk_devices', parent),
				deviceList = data.field_data.device_list;
							
			// loop through each item in deviceList
			for (var deviceId in deviceList) {
				if (deviceList.hasOwnProperty(deviceId)) {
					var device = deviceList[deviceId];
					
					if (miscSettings.enableConsoleLogging) {
						console.log('Hotdesk Device', device);
					}

					$('#' + deviceId + ' .column.third', parent).removeClass('device-registered');
					$('#' + deviceId + ' .column.third', parent).removeClass('device-offline');
					$('#' + deviceId + ' .column.third', parent).removeClass('device-enabled');
					$('#' + deviceId + ' .column.third', parent).removeClass('device-disabled');
			
					// Set 'Online' or 'Offline' based on the 'registered' status
					if (device.enabled === undefined) {
						$('#' + deviceId + ' .column.second', parent).text('Unknown');
						$('#' + deviceId + ' .column.third', parent).text('Unknown');
						$('#' + deviceId + ' .column.third', parent).addClass('device-unknown');
					}

					else if (!device.enabled) {
						$('#' + deviceId + ' .column.third', parent).text('Disabled');
						$('#' + deviceId + ' .column.third', parent).addClass('device-disabled');
					}
			
					else if (device.enabled && !device.registrable) {
						$('#' + deviceId + ' .column.third', parent).text('Enabled');
						$('#' + deviceId + ' .column.third', parent).addClass('device-enabled');
					}
					
					else if (device.enabled && device.registrable && device.registered) {
						$('#' + deviceId + ' .column.third', parent).text('Registered');
						$('#' + deviceId + ' .column.third', parent).addClass('device-registered');
					}
			
					else {
						$('#' + deviceId + ' .column.third', parent).text('Offline');
						$('#' + deviceId + ' .column.third', parent).addClass('device-offline');
					}
				}
			}
		},

		userMigrateData: function(data) {
			if (!('priv_level' in data)) {
				if ('apps' in data && 'voip' in data.apps) {
					data.priv_level = 'admin';
				} else {
					data.priv_level = 'user';
				}
			}

			return data;
		},

		userUpdateSingleDevice: function($checkbox, parent) {
			$checkbox.attr('disabled', 'disabled');

			var self = this,
				device_id = $checkbox.data('device_id'),
				enabled = $checkbox.is(':checked');

			self.userGetDevice(device_id, function(_data) {
				if ($.inArray(_data.device_type, ['cellphone', 'smartphone', 'landline']) > -1) {
					_data.call_forward.enabled = enabled;
				}
				_data.enabled = enabled;
				self.userUpdateDevice(device_id, _data, function(_data) {

					$checkbox.removeAttr('disabled');
					
					$('#tab_devices #' + _data.id + ' .column.third', parent).removeClass('device-registered');
					$('#tab_devices #' + _data.id + ' .column.third', parent).removeClass('device-offline');
					$('#tab_devices #' + _data.id + ' .column.third', parent).removeClass('device-enabled');
					$('#tab_devices #' + _data.id + ' .column.third', parent).removeClass('device-disabled');

					// Set 'Online' or 'Offline' based on the 'registered' status
					if (!_data.enabled) {
						$('#tab_devices #' + _data.id + ' .column.third', parent).text('Disabled');
						$('#tab_devices #' + _data.id + ' .column.third', parent).addClass('device-disabled');
					}

					else if (_data.enabled && !_data.registrable) {
						$('#tab_devices #' + _data.id + ' .column.third', parent).text('Enabled');
						$('#tab_devices #' + _data.id + ' .column.third', parent).addClass('device-enabled');
					}
					
					else if (_data.enabled && v.registrable && _data.registered) {
						$('#tab_devices #' + _data.id + ' .column.third', parent).text('Registered');
						$('#tab_devices #' + _data.id + ' .column.third', parent).addClass('device-registered');
					}

					else {
						$('#tab_devices #' + _data.id + ' .column.third', parent).text('Offline');
						$('#tab_devices #' + _data.id + ' .column.third', parent).addClass('device-offline');
					}

				}, function() {
					$checkbox.removeAttr('disabled');
					enabled ? $checkbox.removeAttr('checked') : $checkbox.attr('checked', 'checked');
				});
			}, function() {
				$checkbox.removeAttr('disabled');
				enabled ? $checkbox.removeAttr('checked') : $checkbox.attr('checked', 'checked');
			});
		},

		userAcquireDevice: function(user_data, success, error) {
			var self = this,
				user_id = user_data.id;

			if (self.random_id) {
				self.userListDevice({ filter_new_user: self.random_id }, function(_data, status) {
					var device_id;
					var array_length = _data.length;
					if (array_length !== 0) {
						$.each(_data, function(k) {
							device_id = this.id;
							self.userGetDevice(device_id, function(_data, status) {
								_data.owner_id = user_id;
								delete _data.new_user;
								self.userUpdateDevice(device_id, _data, function(_data, status) {
									if (k === array_length - 1) {
										success({}, status, 'create');
									}
								});
							});
						});
					} else {
						success({}, status, 'create');
					}
				});
			} else {
				success({}, status, 'create');
			}
		},

		userCleanFormData: function(form_data) {
			form_data.caller_id.internal.number = form_data.caller_id.internal.number.replace(/\s|\(|\)|-|\./g, '');
			form_data.caller_id.external.number = form_data.caller_id.external.number.replace(/\s|\(|\)|-|\./g, '');
			form_data.caller_id.emergency.number = form_data.caller_id.emergency.number.replace(/\s|\(|\)|-|\./g, '');

			//form_data.call_restriction.closed_groups = { action: form_data.extra.closed_groups ? 'deny' : 'inherit' };
			
			if (!miscSettings.hideClosedGroups) {
				var selectedOptionValue = $('select[name="call_restriction.closed_groups.action"]').val();
				form_data.call_restriction.closed_groups = {
					action: selectedOptionValue === 'deny' ? 'deny' : 'inherit'
				};
			}

			if (!_.chain(form_data.caller_id).get('asserted.number', '').isEmpty().value()) {
				form_data.caller_id.asserted.number = monster.util.getFormatPhoneNumber(form_data.caller_id.asserted.number).e164Number;
			}

			if (!form_data.hotdesk.require_pin) {
				delete form_data.hotdesk.pin;
			}

			if (form_data.was_password_updated) {
				form_data.password = form_data.pwd_mngt_pwd1;
			}

			delete form_data.pwd_mngt_pwd1;
			delete form_data.pwd_mngt_pwd2;
			delete form_data.was_password_updated;
			delete form_data.extra;

			return form_data;
		},

		userSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.userNormalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data === 'object' && data.data.id) {
				self.userUpdate(normalized_data, function(_data, status) {
					if (typeof success === 'function') {
						success(_data, status, 'update');
					}
				}, function(_data, status) {
					if (typeof error === 'function') {
						error(_data, status, 'update');
					}
				});
			} else {
				self.userCreate(normalized_data, function(_data, status) {
					if (typeof success === 'function') {
						success(_data, status, 'create');
					}
				}, function(_data, status) {
					if (typeof error === 'function') {
						error(_data, status, 'create');
					}
				});
			}
		},

		userNormalizeData: function(data) {
			var self = this;

			if ($.isArray(data.directories)) {
				data.directories = {};
			}

			self.compactObject(data.caller_id);

			if (_.isEmpty(data.caller_id)) {
				delete data.caller_id;
			}

			if (!data.music_on_hold.media_id) {
				delete data.music_on_hold.media_id;
			}

			if (data.hotdesk.hasOwnProperty('enable')) {
				delete data.hotdesk.enable;
			}

			if (data.hotdesk.hasOwnProperty('log_out')) {
				var new_endpoint_ids = [];

				$.each(data.hotdesk.endpoint_ids, function(k, v) {
					if (data.hotdesk.log_out.indexOf(v) < 0) {
						new_endpoint_ids.push(v);
					}
				});

				data.hotdesk.endpoint_ids = new_endpoint_ids;

				delete data.hotdesk.log_out;
			}

			if (data.hotdesk.hasOwnProperty('endpoint_ids') && data.hotdesk.endpoint_ids.length === 0) {
				delete data.hotdesk.endpoint_ids;
			}

			if (data.hasOwnProperty('call_failover') && data.hasOwnProperty('call_forward')) {
				data.call_failover = _.merge({}, data.call_failover, {
					number: data.call_forward.number,
					require_keypress: data.call_forward.require_keypress,
					keep_caller_id: data.call_forward.keep_caller_id,
					direct_calls_only: data.call_forward.direct_calls_only
				});
			}

			if (data.hasOwnProperty('call_forward') && data.call_forward.number === '') {
				delete data.call_forward.number;
				delete data.call_failover.number;
			}

			if (data.hasOwnProperty('presence_id') && data.presence_id === '') {
				delete data.presence_id;
			}

			if (data.timezone && data.timezone === 'inherit') {
				delete data.timezone;
			}

			if (!_.has(data, 'password') && !_.has(data, 'id')) {
				data.password = monster.util.randomString(8, 'safe');
			}

			// add support for setting find me follow me state
			data.smartpbx.find_me_follow_me = {
				enabled: data.smartpbx.find_me_follow_me.enabled === "true"
			}

			// add support for setting dnd on user doc
			data.do_not_disturb = {
				enabled: data.do_not_disturb.enabled === "true"
			}

			// add support for setting caller id privacy on user doc
			if (data.caller_id_options.outbound_privacy === 'default') {
				delete data.caller_id_options;
			}

			// add support for mainUserCallflowModified
			if (data.dimension && data.dimension.hasOwnProperty('main_user_callflow_modified')) {
				data.dimension.main_user_callflow_modified = data.dimension.main_user_callflow_modified === "true";
			}
			
			return data;
		},

		userList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
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

		userGet: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		userCreate: function(data, callback, error) {
			var self = this;

			self.callApi({
				resource: 'user.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				},
				error: function(data) {
					error && error(data.data);
				}
			});
		},

		userUpdate: function(data, callback, error) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: self.accountId,
					userId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				},
				error: function(data) {
					error && error(data.data);
				}
			});
		},

		userDelete: function(userId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'user.delete',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(error) {
					callbackError && callbackError();
				}
			});
		},

		userListDevice: function(pFilters, callback) {
			var self = this,
				filters = $.extend(true, pFilters, { paginate: false });

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: filters
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		userGetDevice: function(deviceId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'device.get',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data) {
					callbackError && callbackError();
				}
			});
		},

		userUpdateDevice: function(deviceId, data, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'device.update',
				data: {
					accountId: self.accountId,
					deviceId: deviceId,
					data: data
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function() {
					callbackError && callbackError();
				}
			});
		},

		userDeleteDevice: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.delete',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function() {
					callback && callback();
				}
			});
		},

		resetUserCallflow: function(data, callback) {

			var self = this;

			var owner_id = data.data.id,
				presence_id = data.data.presence_id,
				userCallflow = data.field_data.user_callflow;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false,
						filter_owner_id: owner_id,
						filter_mailbox: presence_id
					}
				},
				success: function(_data, status) {
					
					var list = _data.data || [],
						mailbox = list.length > 0 ? list[0] : null;

					var callflow = {
						contact_list: {
							exclude: false
						},
						flow: {
							children: {},
							data: {
								id: data.data.id,
								can_call_self: false,
								timeout: 20
							},
							module: 'user'
						},
						name: userCallflow.name,
						numbers: userCallflow.numbers,
						owner_id: data.data.id,
						id: userCallflow.id,
						type: 'mainUserCallflow',
						ui_metadata: userCallflow.ui_metadata
					};

					if (mailbox) {
						callflow.flow.children._ = {
							children: {},
							data: {
								id: mailbox.id
							},
							module: 'voicemail'
						};
					}

					self.userUpdateCallflow(callflow, function() {
						callback(null);
					});
	
				}
			});

		},
		
		userCallflowGetRingTimeout: function(callflow, findMeFollowMeEnabled) {
			var self = this;

			var targetModule = findMeFollowMeEnabled === true ? 'ring_group' : 'user';

			var node = self.userCallflowGetNode({
				callflow: callflow,
				module: targetModule
			});

			return _.get(node, 'data.timeout');
		},

		userCallflowSetRingTimeout: function(callflow, ringTimeout) {
			var self = this;
				
			var userNode = self.userCallflowGetNode({
				callflow: callflow,
				module: 'user'
			});

			if (!userNode) {
				return false;
			}

			userNode.data.timeout = ringTimeout;
			return true;
		},

		userCallflowGetNode: function(args) {
			var root = _.get(args, 'callflow.flow'),
				targetModule = args.module,
				dataPath = args.dataPath,
				found;

			if (!root) {
				return undefined;
			}

			(function walk(node) {
				if (!node || found) {
					return;
				}

				if (node.module === targetModule) {
					found = node;
					return;
				}

				if (node.children && typeof node.children === 'object') {
					_.each(node.children, function(child) {
						walk(child);
					});
				}
			})(root);

			if (!found) {
				return undefined;
			}

			if (!_.isNil(dataPath)) {
				return _.get(found, dataPath);
			}

			return found;
		},

		usersUpdateVMBoxStatusInCallflow: function(args, callback) {
			var self = this,
				callflow = args.callflow,
				enabled = args.enabled,
				ringTimeout = args.ringTimeout,
				unavailableText = self.i18n.active().callflows.user.unavailable_message;

			var vmNode = self.userCallflowGetNode({
				callflow: callflow,
				module: 'voicemail'
			});

			// toggle voicemail
			if (vmNode) {
				vmNode.data = vmNode.data || {};
				vmNode.data.skip_module = !enabled;
			}

			// set ring timeout on the user node
			if (ringTimeout) {
				self.userCallflowSetRingTimeout(callflow, ringTimeout);
			}

			// ensure children container exists - handles existing callflows before TTS was added
			if (!vmNode.children || typeof vmNode.children !== 'object') {
				vmNode.children = {};
			}

			var ttsNode = vmNode.children._;

			// if missing or not TTS, create/replace it
			if (!ttsNode || ttsNode.module !== 'tts') {
				vmNode.children._ = {
					module: 'tts',
					data: {
						endless_playback: false,
						skip_module: true,
						text: unavailableText,
						terminators: []
					},
					children: {}
				};
				ttsNode = vmNode.children._;
			} else {
				ttsNode.data = ttsNode.data || {};
				ttsNode.data.text = unavailableText;
				if (!ttsNode.data.hasOwnProperty('skip_module')) {
					ttsNode.data.skip_module = true;
				}
			}

			// when voicemail is disabled, enable TTS; when voicemail enabled, disable TTS
			ttsNode.data.skip_module = enabled ? true : false;
			
			self.userUpdateCallflow(callflow, callback, function() {
				callback && callback(null);
			});
		},

		userUpdateCallflow: function(callflow, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.update',
				data: {
					accountId: self.accountId,
					callflowId: callflow.id,
					data: {
						...callflow,
						ui_metadata: {
							origin: 'voip',
							ui: callflow.ui_metadata.ui,
							version: callflow.ui_metadata.version
						}
					},
					removeMetadataAPI: true

				},
				success: function(_callflow_update) {
					if (miscSettings.enableConsoleLogging) {
						console.log('User Callflow Updated', _callflow_update)
					}
					callback(null);
				}
			});
		},

		userCallflowHasMissedCallAlert: function(callflow) {
			var flow = _.get(callflow, 'flow');

			if (!flow || flow.module !== 'missed_call_alert') {
				return null;
			}

			return flow.data;
		},
		
		userCallflowEnableMissedCallAlert: function(callflow, opts) {
			if (callflow.flow.module === 'missed_call_alert') { 
				return callflow; 
			}

			opts = opts || {};

			var oldRoot = _.cloneDeep(callflow.flow);

			callflow.flow = {
				module: 'missed_call_alert',
				data: {
					recipients: [
						{
							type: 'user',
							id: callflow.owner_id
						}
					],
					alert_on_internal_calls: !!opts.alert_on_internal_calls
				},
				children: {
					_: oldRoot
				}
			};

			return callflow;
		},

		userCallflowDisableMissedCallAlert: function(callflow) {
			if (callflow.flow.module !== 'missed_call_alert') { 
				return callflow; 
			}

			var child = _.get(callflow, 'flow.children._');
			
			if (!child) { 
				return callflow; 
			}

			callflow.flow = child;

			return callflow;
		},

		userCallflowGetMissedCallAlertEmailRecipients: function(callflow) {
			var data = this.userCallflowHasMissedCallAlert(callflow);
			if (!data || !Array.isArray(data.recipients)) {
				return [];
			}

			return _.chain(data.recipients)
				.filter({ type: 'email' })
				.map('id')
				.filter(Boolean)
				.value();
		},

		userCallflowHasMissedCallAlertEmailOverride: function(callflow) {
			return this.userCallflowGetMissedCallAlertEmailRecipients(callflow).length > 0;
		},

		userSubmoduleButtons: function(data) {
			var existingItem = true;

			if (!data.data.id) {
				existingItem = false;
			}

			var self = this,
				buttons = $(self.getTemplate({
					name: 'submoduleButtons',
					data: {
						miscSettings: miscSettings,
						existingItem: existingItem,
						hideDelete: hideAdd.user
					}
				}));

			$('.entity-header-buttons').empty();
			$('.entity-header-buttons').append(buttons);

			if (!data.data.id) {
				$('.delete', '.entity-header-buttons').addClass('disabled');
			}
		
		},

		usersRenderFindMeFollowMe: function(data, devices, parent) {
			var self = this;
			parent = $('#tab_find_me_follow_me', parent);

			$('.rows', parent).empty();

			var scaleSections = 6,
				scaleMaxSeconds = 120,
				ringGroup = data.field_data.ring_group;
			
			var sliderTooltip = function(event, ui, deviceId) {
				// update delay and timeout values in the respective columns
				$(`#delay_value_${deviceId}`).text(ui.values[0] + 's');
				$(`#timeout_value_${deviceId}`).text(ui.values[1] + 's');
			};
		
			var createSliderScale = function(container) {
				var scaleContainer = container.find('.scale-container');
				scaleContainer.empty();
				for (var i = 1; i <= scaleSections; i++) {
					var toAppend = '<div class="scale-element" style="width:' + (100 / scaleSections) + '%;">' +
						(i === scaleSections
							? '<input type="text" value="' + scaleMaxSeconds + '" class="scale-max-input" maxlength="3"><span class="scale-max">'
							: '<span>') +
						Math.floor(i * scaleMaxSeconds / scaleSections) + ' Sec</span></div>';
					scaleContainer.append(toAppend);
				}
				scaleContainer.append('<span>0 Sec</span>');
			};
		
			if (devices.length > 0) {

				$.each(devices, function(index, device) {
					device.not_enabled = device.enabled === false;
		
					var ringGroupEndpoint = ringGroup.endpoints ? ringGroup.endpoints.find(endpoint => endpoint.id === device.id) : null;
					var isDeviceInRingGroup = !!ringGroupEndpoint;
		
					device.checkbox_checked = isDeviceInRingGroup ? 'checked' : '';
					device.show_slider = isDeviceInRingGroup;
					device.delay_value = isDeviceInRingGroup ? ringGroupEndpoint.delay : 0;
					device.timeout_value = isDeviceInRingGroup ? ringGroupEndpoint.delay + ringGroupEndpoint.timeout : 120;
		
					$('.rows', parent)
						.append($(self.getTemplate({
							name: 'findMeFollowMeRow',
							data: {
								...device,
								miscSettings: miscSettings,
							},
							submodule: 'user'
						})));
		
					if (device.show_slider) {
						var target = $(`#slider_${device.id}`);
		
						target.slider({
							range: true,
							min: 0,
							max: scaleMaxSeconds,
							values: [device.delay_value, device.timeout_value],
							slide: function(event, ui) {
								// check which handle is being moved
								var handleIndex = $(ui.handle).index();

								//console.log('ui.values[0]', ui.values[0]); // min
								//console.log('ui.values[1]', ui.values[1]); // max
								
								// logic for minimum handle
								if (handleIndex == 1) {
									if (ui.values[1] == ui.values[0] && ui.values[1] !== 120) {
										ui.values[1] = ui.values[0] + 1;
									}
								} 
								
								// logic for minimum handle
								if (handleIndex == 2) {
									if (ui.values[0] == ui.values[1] && ui.values[0] !== 0) {
										ui.values[0] = ui.values[1] - 1;
									}
								} 
		
								// update the slider values
								target.slider("values", ui.values);
								sliderTooltip(event, ui, device.id);
							},
							change: function(event, ui) {
								sliderTooltip(event, ui, device.id);

								// update the ringGroup endpoint with new delay and timeout values
								var endpoint = data.field_data.ring_group.endpoints.find(endpoint => endpoint.id === device.id);
								if (endpoint) {
									endpoint.delay = ui.values[0];
									endpoint.timeout = ui.values[1] - ui.values[0];

									// function to calculate the maximum delay + timeout across all endpoints
									const getMaxDelayTimeoutSum = (endpoints) => {
										return endpoints.reduce((maxSum, ep) => {
											const currentSum = ep.delay + ep.timeout;
											return currentSum > maxSum ? currentSum : maxSum;
										}, 0);
									};

									// get the maximum delay + timeout sum
									const maxDelayTimeoutSum = getMaxDelayTimeoutSum(data.field_data.ring_group.endpoints);

									data.field_data.ring_group.timeout = maxDelayTimeoutSum;

								}

							}
						});
		
						var handles = target.find('.ui-slider-handle');

						handles.eq(0).attr('id', `min_handle_${device.id}`);
						handles.eq(1).attr('id', `max_handle_${device.id}`);
		
						if ($(`#device_row_${device.id}`).hasClass('deleted')) {
							target.slider('disable');
						}
		
						createSliderScale($(`#device_row_${device.id}`));

					} else {
						// clear delay and timeout if slider not being shown
						$(`#delay_value_${device.id}`).text('');
						$(`#timeout_value_${device.id}`).text('');
					}

				});
			}

		},	
		
		addFindMeFollowMeSlider(data, deviceId, targetColumn) {
			var scaleSections = 6,
				scaleMaxSeconds = 120;

			var sliderTooltip = function(event, ui, deviceId) {
				// update delay and timeout values in the respective columns
				$(`#delay_value_${deviceId}`).text(ui.values[0] + 's');
				$(`#timeout_value_${deviceId}`).text(ui.values[1] + 's');
			};

			// function to create the scale for the slider
			var createSliderScale = function(container) {
				var scaleContainer = container.find('.scale-container');
				scaleContainer.empty();
				for (var i = 1; i <= scaleSections; i++) {
					var toAppend = '<div class="scale-element" style="width:' + (100 / scaleSections) + '%;">' +
						(i === scaleSections
							? '<input type="text" value="' + scaleMaxSeconds + '" class="scale-max-input" maxlength="3"><span class="scale-max">'
							: '<span>') +
						Math.floor(i * scaleMaxSeconds / scaleSections) + ' Sec</span></div>';
					scaleContainer.append(toAppend);
				}
				scaleContainer.append('<span>0 Sec</span>');
			};

			// check if the slider-container already exists, if not create it
			var sliderContainer = targetColumn.find('.slider-container');
			if (sliderContainer.length === 0) {
				sliderContainer = $('<div class="slider-container" data-device_id="' + deviceId + '"></div>');
				targetColumn.append(sliderContainer);
			}
		
			// create the slider element
			var sliderHtml = `<div id="slider_${deviceId}" class="slider"></div>`;
			sliderContainer.append(sliderHtml);

			// retrieve the device data
			var device = {
				id: deviceId,
				delay_value: 0,
				timeout_value: 120
			};

			var target = targetColumn.find(`#slider_${deviceId}`);
			
			target.slider({
				range: true,
				min: 0,
				max: scaleMaxSeconds,
				values: [device.delay_value, device.timeout_value],

				slide: function(event, ui) {
					// check which handle is being moved
					var handleIndex = $(ui.handle).index();

					//console.log('ui.values[0]', ui.values[0]); // min
					//console.log('ui.values[1]', ui.values[1]); // max
					
					// logic for minimum handle
					if (handleIndex == 1) {
						if (ui.values[1] == ui.values[0] && ui.values[1] !== 120) {
							ui.values[1] = ui.values[0] + 1;
						}
					} 
					
					// logic for minimum handle
					if (handleIndex == 2) {
						if (ui.values[0] == ui.values[1] && ui.values[0] !== 0) {
							ui.values[0] = ui.values[1] - 1;
						}
					} 

					// update the slider values
					target.slider("values", ui.values);
					sliderTooltip(event, ui, device.id);
				},
				change: function(event, ui) {
					sliderTooltip(event, ui, device.id);

					// update the ringGroup endpoint with new delay and timeout values
					var endpoint = data.field_data.ring_group.endpoints.find(endpoint => endpoint.id === device.id);
					if (endpoint) {
						endpoint.delay = ui.values[0];
						endpoint.timeout = ui.values[1] - ui.values[0];

						// function to calculate the maximum delay + timeout across all endpoints
						const getMaxDelayTimeoutSum = (endpoints) => {
							return endpoints.reduce((maxSum, ep) => {
								const currentSum = ep.delay + ep.timeout;
								return currentSum > maxSum ? currentSum : maxSum;
							}, 0);
						};

						// get the maximum delay + timeout sum
						const maxDelayTimeoutSum = getMaxDelayTimeoutSum(data.field_data.ring_group.endpoints);

						data.field_data.ring_group.timeout = maxDelayTimeoutSum;

					}

				}


			});

			var handles = target.find('.ui-slider-handle');
			
			handles.eq(0).attr('id', `min_handle_${deviceId}`);
			handles.eq(1).attr('id', `max_handle_${deviceId}`);

			// set default timer values
			$(`#delay_value_${device.id}`).text('0s');
			$(`#timeout_value_${device.id}`).text('120s');

			// set default ring group timeout value
			data.field_data.ring_group.timeout = 120;

			createSliderScale(targetColumn); 
		}

	};

	return app;
});
