define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		hideAdd = false,
		hideClassifiers = {},
		miscSettings = {},
		dimensionDeviceType = {},
		deviceAudioCodecs = {},
		deviceVideoCodecs = {},
		pusherApps = {};

	var app = {
		requests: {
			'callflows.device.getProvisionerPhones': {
				'apiRoot': monster.config.api.provisioner,
				'url': 'phones/',
				'verb': 'GET',
				'headers': {
					'Accept': '*/*'
				}
			}
		},

		subscribe: {
			'callflows.fetchActions': 'deviceDefineActions',
			'callflows.device.popupEdit': 'devicePopupEdit',
			'callflows.device.edit': '_deviceEdit',
			'callflows.device.submoduleButtons': 'deviceSubmoduleButtons'
		},

		devicePopupEdit: function(args) {
			var self = this,
				popup,
				popup_html,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults;

			popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>');

			if (miscSettings.callflowButtonsWithinHeader) {
				miscSettings.popupEdit = true;
			}

			self.deviceEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: (data.id) ? self.i18n.active().callflows.device.edit_device : self.i18n.active().callflows.device.create_device
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring deviceEdit
		_deviceEdit: function(args) {
			var self = this;
			self.deviceEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		deviceEdit: function(data, _parent, _target, _callbacks, data_defaults) {

			var self = this,
				parent = _parent || $('#device-content'),
				target = _target || $('#device-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success,
					save_error: _callbacks.save_error || function(_data, status, type) {
						if (status === 200 && type === 'mac_address') {
							monster.ui.alert(self.i18n.active().callflows.device.this_mac_address_is_already_in_use);
						}
					},
					delete_success: _callbacks.delete_success,
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						enabled: true,
						caller_id: {
							external: {},
							internal: {},
							emergency: {}
						},
						ringtones: {},
						call_restriction: {
							closed_groups: { action: 'inherit' }
						},
						media: {
							secure_rtp: 'none',
							audio: {
								codecs: []
							},
							video: {
								codecs: []
							},
							fax: {
								option: 'false'
							},
							fax_option: false
						},
						sip: {
							method: 'password',
							invite_format: 'contact',
							username: 'user_' + monster.util.randomString(6),
							password: monster.util.randomString(12),
							expire_seconds: '360'
						},
						contact_list: {
							exclude: false
						},
						call_forward: {},
						music_on_hold: {}
					}, data_defaults || {}),

					field_data: {
						users: [],
						call_restriction: {},
						sip: {
							methods: {
								'password': self.i18n.active().callflows.device.password,
								'ip': 'IP'
							},
							invite_formats: {
								'username': 'Username',
								'npan': 'NPA NXX XXXX',
								'e164': 'E. 164',
								'1npan': '1npan',
								'route': 'Route',
								'contact': 'Contact'
							}
						},
						media: {
							secure_rtp: {
								value: 'none',
								options: {
									'none': self.i18n.active().callflows.device.none,
									'srtp': self.i18n.active().callflows.device.srtp,
									'zrtp': self.i18n.active().callflows.device.zrtp
								}
							},
							fax: {
								options: {
									'auto': self.i18n.active().callflows.device.auto_detect,
									'true': self.i18n.active().callflows.device.always_force,
									'false': self.i18n.active().callflows.device.disabled
								}
							},
							audio: {
								codecs: {
									'AMR-WB': 'AMR Wideband',
									'AMR': 'AMR Narrowband',
									'OPUS': 'OPUS',
									'CELT@32000h': 'Siren @ 32Khz',
									'G7221@32000h': 'G722.1 @ 32khz',
									'G7221@16000h': 'G722.1 @ 16khz',
									'G722': 'G722',
									'speex@32000h': 'Speex @ 32khz',
									'speex@16000h': 'Speex @ 16khz',
									'PCMU': 'G711u / PCMU - 64kbps (North America)',
									'PCMA': 'G711a / PCMA - 64kbps (Elsewhere)',
									'G729': 'G729 - 8kbps (Requires License)',
									'GSM': 'GSM',
									'CELT@48000h': 'Siren (HD) @ 48kHz',
									'CELT@64000h': 'Siren (HD) @ 64kHz'
								}
							},
							video: {
								codecs: {
									'VP8': 'VP8',
									'H264': 'H264',
									'H263': 'H263',
									'H261': 'H261'
								}
							}
						},
						device_callflow: null,
						phone_numbers: [],
						extension_numbers: [],
						callflow_numbers: [],
						hide_owner: data.hide_owner || false,
						outbound_flags: data.outbound_flags ? data.outbound_flags.join(', ') : data.outbound_flags
					},
					functions: {
						inArray: function(value, array) {
							if (array) {
								return ($.inArray(value, array) === -1) ? false : true;
							} else {
								return false;
							}
						}
					}
				},
				
				parallelRequests = function(deviceData) {

					// clear dimensionsDeviceType so device page loads correctly when switching between devices
					dimensionDeviceType = {}

					if (deviceData.hasOwnProperty('dimension') && deviceData.dimension.hasOwnProperty('type')) {
						dimensionDeviceType[deviceData.dimension.type] = true;
						dimensionDeviceType['preventDelete'] = true;
						dimensionDeviceType['showDeviceSimplifiedSipSettings'] = false;
					
						if (deviceData.dimension.model == 'UCS' || deviceData.dimension.type == 'legacypbx') {
							dimensionDeviceType['showDeviceSimplifiedSipSettings'] = true;
						}

						if (deviceData.dimension.model == 'UCM') {
							dimensionDeviceType['pusherDevice'] = true;
						}

						if (miscSettings.enableConsoleLogging) {
							console.log('Device Details', dimensionDeviceType);
							console.log('Device Doc Details', deviceData.dimension);
						}

					}

					if (miscSettings.callflowButtonsWithinHeader) {
						//debugger;
						self.deviceSubmoduleButtons(deviceData);
					};

					//monster.parallel(_.merge({
					var parallelFunctions = _.merge({

						get_callflow: function(callback) {

							// if the device is classed as a communal get associated callflow
							if ((dimensionDeviceType.communal && miscSettings.deviceShowCommunalPhoneNumbers)) {

								self.callApi({
									resource: 'callflow.list',
									data: {
										accountId: self.accountId,
										filters: {
											"filter_dimension.deviceOwnerId": deviceData.id
										}
									},
									success: function(callflow) {
			
										if (callflow.data.length > 0 && callflow.data[0].numbers.length > 0) {
			
											// set callflow id for the user
											defaults.field_data.device_callflow = callflow.data[0].id;
									
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
												console.log('Callflow ID', callflow.data[0].id)
												console.log('Phone Numbers', formattedPhoneNumbers)
												console.log('Extension Numbers', formattedExtensionNumbers)
											}
										
											defaults.field_data.callflow_numbers = callflow.data[0].numbers
											defaults.field_data.phone_numbers = formattedPhoneNumbers;
											defaults.field_data.extension_numbers = formattedExtensionNumbers;
											
										}
			
										callback(null, callflow);
			
									}
								});

							}

							else {

								callback(null);

							}
						
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
					
						list_classifier: function(callback) {
							self.callApi({
								resource: 'numbers.listClassifiers',
								data: {
									accountId: self.accountId,
									filters: {
										paginate: false
									}
								},
								success: function(_data_classifiers) {
									
									/*
									if ('data' in _data_classifiers) {
										$.each(_data_classifiers.data, function(k, v) {
											defaults.field_data.call_restriction[k] = {
												friendly_name: v.friendly_name
											};

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
						account: function(callback) {
							self.callApi({
								resource: 'account.get',
								data: {
									accountId: self.accountId
								},
								success: function(_data, status) {
									$.extend(defaults.field_data.sip, {
										realm: _data.data.realm
									});

									callback(null, _data);
								}
							});
						},
						user_list: function(callback) {
							self.callApi({
								resource: 'user.list',
								data: {
									accountId: self.accountId,
									filters: {
										paginate: false
									}
								},
								success: function(_data, status) {
									_data.data.sort(function(a, b) {
										return (a.first_name + a.last_name).toLowerCase() < (b.first_name + b.last_name).toLowerCase() ? -1 : 1;
									});

									_data.data.unshift({
										id: '',
										first_name: self.i18n.active().callflowsApp.common.noOwner,
										last_name: ''
									});

									if (
										deviceData.hasOwnProperty('device_type')
										&& _.includes(['application', 'mobile'], deviceData.device_type)
									) {
										var userData = _.find(_data.data, function(user) { return user.id === deviceData.owner_id; });

										if (userData) {
											defaults.field_data.users = userData;
										} else {
											defaults.field_data.users = {
												first_name: self.i18n.active().callflowsApp.common.noOwner,
												last_name: ''
											};
										}
									} else {
										defaults.field_data.users = _data.data;
									}

									callback(null, _data);
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

									mediaList.unshift(
										{
											id: '',
											name: self.i18n.active().callflows.device.default_music
										},
										{
											id: 'silence_stream://300000',
											name: self.i18n.active().callflows.device.silence
										},
										{
											id: 'shoutcast',
											name: self.i18n.active().callflows.accountSettings.musicOnHold.shoutcastURL
										}
									);

									defaults.field_data.music_on_hold = mediaList;
									callback(null, _data);
								}
							});
						},
						provisionerData: function(callback) {
							if (monster.config.api.hasOwnProperty('provisioner') && monster.config.api.provisioner) {
								self.deviceGetDataProvisoner(function(data) {
									callback(null, data);
								});
							} else {
								callback(null, {});
							}
						}

					});

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
						};
					}

					monster.parallel(parallelFunctions, function(err, results) {
						var render_data = self.devicePrepareDataForTemplate(data, defaults, $.extend(true, results, {
							get_device: deviceData
						}));

						if (results.emergencyCallerIdNumbers) {
							render_data.extra.emergencyCallerIdNumbers = results.emergencyCallerIdNumbers;
						}

						self.deviceRender(render_data, target, callbacks);

						if (typeof callbacks.after_render === 'function') {
							callbacks.after_render();
						}

						if (miscSettings.callflowButtonsWithinHeader) {
							miscSettings.popupEdit = false;
						}
						
					});
				};

			if (typeof data === 'object' && data.id) {
				self.deviceGet(data.id, function(_data, status) {
					defaults.data.device_type = 'sip_device';

					// support distinctive ringtone dropdown if enabled
					if (miscSettings.deviceDistinctiveRingtones) { 
						if (_data.ringtones && _data.ringtones.external == 'alert-external' && _data.ringtones.internal == 'alert-internal') {
							defaults.data.ringtones.distinctive = 'enabled';
						} else {
							defaults.data.ringtones.distinctive = 'disabled';
						}
					}

					if ('media' in _data && 'encryption' in _data.media) {
						defaults.field_data.media.secure_rtp.value = _data.media.encryption.enforce_security ? _data.media.encryption.methods[0] : 'none';
					}

					if ('sip' in _data && 'realm' in _data.sip) {
						defaults.field_data.sip.realm = _data.sip.realm;
					}

					self.deviceMigrateData(_data);

					parallelRequests(_data);
				});
			} else {
				parallelRequests(defaults);
			}
		},

		devicePrepareDataForTemplate: function(data, dataGlobal, results) {
			var self = this,
				dataDevice = results.get_device,
				dataProvisioner = results.provisionerData;

			if (typeof data === 'object' && data.id) {
				dataGlobal = $.extend(true, dataGlobal, { data: dataDevice });
			}

			if (dataDevice.hasOwnProperty('media') && dataDevice.media.hasOwnProperty('audio')) {
				// If the codecs property is defined, override the defaults with it. Indeed, when an empty array is set as the
				// list of codecs, it gets overwritten by the extend function otherwise.
				if (dataDevice.media.audio.hasOwnProperty('codecs')) {
					dataGlobal.data.media.audio.codecs = dataDevice.media.audio.codecs;
				}

				if (dataDevice.media.video.hasOwnProperty('codecs')) {
					dataGlobal.data.media.video.codecs = dataDevice.media.video.codecs;
				}
			}

			_.each(dataGlobal.field_data.call_restriction, function(restriction, key) {
				restriction.value = dataGlobal.data.call_restriction[key].action;
			});

			dataGlobal.field_data.provisioner = dataProvisioner;
			dataGlobal.field_data.provisioner.isEnabled = !_.isEmpty(dataProvisioner);

			if (dataGlobal.field_data.provisioner.isEnabled) {
				var default_provision_data = {
					voicemail_beep: 1, //ie enabled
					time_format: '12',
					hotline: '',
					vlan: {
						enable: false,
						number: ''
					},
					date_format: 'middle-endian'
				};

				dataGlobal.data.provision = $.extend(true, {}, default_provision_data, dataGlobal.data.provision);
			}

			dataGlobal.extra = _.merge({}, dataGlobal.extra, {
				isShoutcast: false
			}, _.pick(results, [
				'cidNumbers',
				'phoneNumbers'
			]));

			// if the value is set to a stream, we need to set the value of the media_id to shoutcast so it gets selected by the old select mechanism,
			// but we also need to store the  value so we can display it
			if (dataGlobal.data.hasOwnProperty('music_on_hold') && dataGlobal.data.music_on_hold.hasOwnProperty('media_id')) {
				if (dataGlobal.data.music_on_hold.media_id.indexOf('://') >= 0) {
					if (dataGlobal.data.music_on_hold.media_id !== 'silence_stream://300000') {
						dataGlobal.extra.isShoutcast = true;
						dataGlobal.extra.shoutcastValue = dataGlobal.data.music_on_hold.media_id;
						dataGlobal.data.music_on_hold.media_id = 'shoutcast';
					}
				}
			}

			if (dimensionDeviceType.pusherDevice) {
				if (dataGlobal.data.hasOwnProperty('push')) {

					var pusher_settings = {},
						token_type = dataGlobal.data.push['Token-Type'];
						token_app = dataGlobal.data.push['Token-App'];
					
					if (token_type == 'apple') {
						pusher_settings.device_type = 'Apple'
					} else if (token_type == 'firebase' || token_type == 'firebase_v1') {
						pusher_settings.device_type = 'Android'
					} else {
						pusher_settings.device_type = 'Unknown'
					}
	
					if (token_app && pusherApps[token_app]) {
						pusher_settings.app_name = pusherApps[token_app];
					} else {
						pusher_settings.app_name = token_app;
					}

					dataGlobal.field_data.pusher_settings = pusher_settings;

				} else {

					var pusher_settings = {
						'device_type': 'Not Configured',
						'app_name': 'Not Configured'
					}

					dataGlobal.field_data.pusher_settings = pusher_settings;

				}
			}

			return dataGlobal;
		},

		deviceGetValidationByDeviceType: function(deviceType) {
			var self = this,
				i18n = self.i18n.active(),
				validation = {
					ata: {
						'sip.ip': {
							required: true,
							ipv4: true
						}
					},
					sip_uri: {},
					sip_device: {
						'mac_address': { mac: true },
						'sip_expire_seconds': {	digits: true },
						'sip.ip': {
							ipv4: true,
							required: true
						},
						'extra.shoutcastUrl': { protocol: true }
					},
					fax: {
						'mac_address': { mac: true },
						'sip_expire_seconds': {	digits: true },
						'sip.ip': {
							ipv4: true,
							required: true
						}
					},
					cellphone: {},
					smartphone: {
						'sip_expire_seconds': {	digits: true },
						'sip.ip': {
							ipv4: true,
							required: true
						}
					},
					landline: {},
					softphone: {
						'sip_expire_seconds': {	digits: true },
						'extra.shoutcastUrl': { protocol: true }
					},
					mobile: {
						'mdn': { digits: true },
						'sip_expire_seconds': {	digits: true },
						'extra.shoutcastUrl': { protocol: true }
					}
				},
				deviceTypeValidation = {
					rules: validation[deviceType]
				};

			if (_.includes(['ata', 'fax', 'mobile', 'sip_device', 'softphone'], deviceType)) {
				_.merge(deviceTypeValidation, {
					rules: {
						'caller_id.asserted.name': { regex: /^[0-9A-Za-z ,]{0,30}$/ },
						'caller_id.asserted.number': { phoneNumber: true },
						'caller_id.asserted.realm': { realm: true }
					},
					messages: {
						'caller_id.asserted.name': { regex: i18n.callflows.device.validation.caller_id.name },
						'caller_id.asserted.number': { regex: i18n.callflows.device.validation.caller_id.number },
						'caller_id.asserted.realm': { regex: i18n.callflows.device.validation.caller_id.realm }
					}
				});
			}

			return deviceTypeValidation;
		},

		deviceRender: function(data, target, callbacks) {

			if (miscSettings.enableConsoleLogging) {
				console.log('Device Data', data)
			}

			var self = this,
				hasExternalCallerId = monster.util.getCapability('caller_id.external_numbers').isEnabled || miscSettings.enableCallerIdDropdown,
				cidSelectors = [
					'external',
					'emergency',
					'asserted'
				],
				device_html,
				allowAddingExternalCallerId,
				emergencyCallerIdAlertShown;

			if (miscSettings.preventAddingExternalCallerId) {
				allowAddingExternalCallerId = false
			}
			else {
				allowAddingExternalCallerId = true
			}

			if (data.data.hasOwnProperty('dimension') && data.data.dimension.hasOwnProperty('type')) {
				dimensionDeviceType[data.data.dimension.type] = true;
				dimensionDeviceType['preventDelete'] = true;
			}

			if ('media' in data.data && 'fax_option' in data.data.media) {
				data.data.media.fax_option = (data.data.media.fax_option === 'auto' || data.data.media.fax_option === true);
			}

			if (typeof data.data === 'object' && data.data.device_type) {
				device_html = $(self.getTemplate({
					name: 'device-' + data.data.device_type,
					data: _.merge({
						hideAdd: hideAdd,
						miscSettings: miscSettings,
						dimensionDeviceType: dimensionDeviceType,
						hasExternalCallerId: hasExternalCallerId,
						showPAssertedIdentity: monster.config.whitelabel.showPAssertedIdentity
					}, _.pick(data.extra, [
						'phoneNumbers'
					]), data),
					submodule: 'device'
				}));

				var defaultAudioCodecs;

				if (miscSettings.deviceSetDefaultAudioCodecs) {
					if ((data.data.media.audio.codecs).length == 0) {
						defaultAudioCodecs = Object.keys(deviceAudioCodecs.defaultCodecs)
					} else  {
						defaultAudioCodecs = data.data.media.audio.codecs;
					}
				} else {
					defaultAudioCodecs = data.data.media.audio.codecs;
				}

				if (miscSettings.enableConsoleLogging) {
					console.log('Audio Codecs', deviceAudioCodecs);
					console.log('Video Codecs', deviceVideoCodecs);
					console.log('Current Device Codecs', data.data.media.audio.codecs)
				}
				
				if (miscSettings.deviceSetAudioCodecs) {
					if (device_html.find('#media_audio_codecs')) {
						var audioSelector = self.customDeviceCodecSelector('audio', device_html.find('#media_audio_codecs'), defaultAudioCodecs, deviceAudioCodecs);
					};
				} else {
					if (device_html.find('#media_audio_codecs')) {
						var audioSelector = monster.ui.codecSelector('audio', device_html.find('#media_audio_codecs'), data.data.media.audio.codecs);
					};
				}

				if (miscSettings.deviceSetVideoCodecs) {
					if (device_html.find('#media_video_codecs')) {
						var videoSelector = self.customDeviceCodecSelector('video', device_html.find('#media_video_codecs'), data.data.media.video.codecs, deviceVideoCodecs);
					};
				} else {
					if (device_html.find('#media_video_codecs')) {
						var videoSelector = monster.ui.codecSelector('video', device_html.find('#media_video_codecs'), data.data.media.video.codecs);
					};
				}

				if (device_html.find('#caller_id').length && hasExternalCallerId) {
					_.forEach(cidSelectors, function(selector) {

						var $target = device_html.find('.caller-id-' + selector + '-target'),
							selectedNumber = _.get(data.data, ['caller_id', selector, 'number']);

						if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
							phoneNumbers = selector === 'emergency' || selector === 'asserted'
							? { phoneNumbers: [...data.extra.emergencyCallerIdNumbers] }
							: _.pick(data.extra, ['cidNumbers', 'phoneNumbers']);
						} else {
							phoneNumbers = _.pick(data.extra, [
								'cidNumbers',
								'phoneNumbers'
							])
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

						if (!$target.length) {
							return;
						}
						monster.ui.cidNumberSelector($target, _.merge({
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
				}

				if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
					function invalidEmergencyCallerId() {

						device_html.find('select[name^="caller_id."]').each(function() {
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

					device_html.find('select[name^="caller_id."]').change(invalidEmergencyCallerId);
				}

				if (miscSettings.readOnlyCallerIdName) {
					device_html.find('.caller-id-external-number').on('change', function(event) {
						phoneNumber = $('.caller-id-external-number select[name="caller_id.external.number"]').val();
						formattedNumber = phoneNumber.replace(/^\+44/, '0');
						$('#caller_id_name_external', device_html).val(formattedNumber);	
					});
				}
	
				if (miscSettings.readOnlyCallerIdName) {
					device_html.find('.caller-id-emergency-number').on('change', function(event) {
						phoneNumber = $('.caller-id-emergency-number select[name="caller_id.emergency.number"]').val();
						formattedNumber = phoneNumber.replace(/^\+44/, '0');
						$('#caller_id_name_emergency', device_html).val(formattedNumber);	
					});
				}
	
				if (miscSettings.readOnlyCallerIdName) {
					device_html.find('.caller-id-asserted-number').on('change', function(event) {
						phoneNumber = $('.caller-id-asserted-number select[name="caller_id.asserted.number"]').val();
						formattedNumber = phoneNumber.replace(/^\+44/, '0');
						$('#advanced_caller_id_name_asserted', device_html).val(formattedNumber);	
					});
				}

				var deviceForm = device_html.find('#device-form');

				if (monster.config.api.hasOwnProperty('provisioner') && monster.config.api.provisioner) {
					self.deviceSetProvisionerStuff(device_html, data);
				}

				if ((dimensionDeviceType.communal && miscSettings.deviceShowCommunalPhoneNumbers)) {
					self.deviceRenderNumberList(data, device_html);
				}
				
				monster.ui.validate(deviceForm, self.deviceGetValidationByDeviceType(data.data.device_type));

				if (!$('#owner_id', device_html).val()) {
					$('#edit_link', device_html).hide();
				}

				device_html.find('input[data-mask]').each(function() {
					var $this = $(this);
					monster.ui.mask($this, $this.data('mask'));
				});

				// add search to dropdown
				device_html.find('#owner_id').chosen({
					width: '224px',
					disable_search_threshold: 0,
					search_contains: true
				})

				// add search to dropdown
				device_html.find('#music_on_hold_media_id').chosen({
					width: '224px',
					disable_search_threshold: 0,
					search_contains: true
				})

				if (!$('#music_on_hold_media_id', device_html).val()) {
					$('#edit_link_media', device_html).hide();
				}

				if (data.data.sip && data.data.sip.method === 'ip') {
					$('#username_block', device_html).hide();
				} else {
					$('#ip_block', device_html).hide();
				}

				if (dimensionDeviceType.pusherDevice && data.field_data?.pusher_settings?.app_name == 'Not Configured') {
					$('#pusher_details_delete', device_html).prop('disabled', true);
				}

			} else {
				device_html = $(self.getTemplate({
					name: 'general_edit',
					data: {
						hideDeviceTypes: hideDeviceTypes,
						showTeammateDevice: _
							.chain(monster.config)
							.get('allowedExtraDeviceTypes', [])
							.includes('teammate')
							.value()
					},
					submodule: 'device'
				}));

				$('.media_pane', device_html).hide();
			}

			// find the first enabled device to show the edit page for that
			device_html = $('<div>').append(device_html);
			buttons = device_html.find('.buttons');
			firstButton = buttons.first();
			firstEnabledDevice = firstButton.attr('device_type');
			defaultDeviceSelector = `.media_tabs .buttons[device_type="${firstEnabledDevice}"]`;

			$('*[rel=popover]:not([type="text"])', device_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', device_html).popover({
				trigger: 'focus'
			});

			if ((dimensionDeviceType.communal && miscSettings.deviceShowCommunalPhoneNumbers)) {
				$('.add-phone-number', device_html).click(function(ev) {

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
								submodule: 'device'
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

							self.deviceRenderNumberList(data, device_html)
						
							popup.dialog('close');

						});

					});
				});
			}
			
			self.winkstartTabs(device_html);

			self.deviceBindEvents({
				data: data,
				template: device_html,
				callbacks: callbacks,
				selectors: {
					audio: audioSelector,
					video: videoSelector
				}
			});

			(target)
				.empty()
				.append(device_html);

		
			//$('.media_tabs .buttons[device_type="sip_device"]', device_html).trigger('click');
			
			// show the edit page for the first device that was found
			$(defaultDeviceSelector, device_html).trigger('click');

		},

		/**
		 * Bind events for the device edit template
		 * @param  {Object} args
		 * @param  {Object} args.data
		 * @param  {Object} args.template
		 * @param  {Object} args.callbacks
		 * @param  {Object} args.selectors
		 * @param  {Function} args.callbacks.save_success
		 * @param  {Function} args.callbacks.delete_success
		 * @param  {Object} args.selectors.audio
		 * @param  {Object} args.selectors.video
		 */
		deviceBindEvents: function(args) {
			var self = this,
				data = args.data,
				callbacks = args.callbacks,
				device_html = args.template,
				audioSelector = args.selectors.audio,
				videoSelector = args.selectors.video;

			if (typeof data.data === 'object' && data.data.device_type) {
				var deviceForm = device_html.find('#device-form');

				$('#owner_id', device_html).change(function() {
					!$('#owner_id option:selected', device_html).val() ? $('#edit_link', device_html).hide() : $('#edit_link', device_html).show();
				});

				$('.inline_action', device_html).click(function(ev) {
					var _data = ($(this).data('action') === 'edit') ? { id: $('#owner_id', device_html).val() } : {},
						_id = _data.id;

					ev.preventDefault();

					monster.pub('callflows.user.popupEdit', {
						data: _data,
						callback: function(user) {
							/* Create */
							if (!_id) {
								$('#owner_id', device_html).append('<option id="' + user.id + '" value="' + user.id + '">' + user.first_name + ' ' + user.last_name + '</option>');
								$('#owner_id', device_html).val(user.id);
								$('#edit_link', device_html).show();
							} else {
								/* Update */
								if (_data.hasOwnProperty('id')) {
									$('#owner_id #' + user.id, device_html).text(user.first_name + ' ' + user.last_name);
								/* Delete */
								} else {
									$('#owner_id #' + _id, device_html).remove();
									$('#edit_link', device_html).hide();
								}
							}
						}
					});
				});


				device_html.find('#device-form').on('submit', function(ev) {
					saveButtonEvents(ev)
				});

				$('#submodule-buttons-container .save')
					.off('click')  // remove any existing click handlers
					.click(function(ev) {
						saveButtonEvents(ev);
				});

				function saveButtonEvents(ev) {

					ev.preventDefault();

					var $this = $(this);

					if (!$this.hasClass('disabled')) {
						$this.addClass('disabled');
						if (monster.ui.valid(deviceForm)) {
							var form_data = monster.ui.getFormData('device-form'),
								hasCodecs = $.inArray(form_data.device_type, ['sip_device', 'softphone', 'mobile']) > -1;

							if (form_data.hasOwnProperty('music_on_hold') && form_data.music_on_hold.media_id === 'shoutcast') {
								form_data.music_on_hold.media_id = device_html.find('.shoutcast-url-input').val();
							}

							if (hasCodecs) {
								form_data.media = $.extend(true, {
									audio: {
										codecs: []
									},
									video: {
										codecs: []
									}
								}, form_data.media);
							}

							if (hasCodecs) {
								if (audioSelector) {
									form_data.media.audio.codecs = audioSelector.getSelectedItems();
								}

								if (videoSelector) {
									form_data.media.video.codecs = videoSelector.getSelectedItems();
								}
							}
							self.deviceCleanFormData(form_data);

							if (form_data.hasOwnProperty('provision') && form_data.provision.hasOwnProperty('endpoint_brand') && form_data.provision.endpoint_brand !== 'none') {
								var modelArray = $('.dropdown_family[data-brand="' + form_data.provision.endpoint_brand + '"]', device_html).val().split('.'),
									endpoint_family = modelArray[0],
									endpoint_model = modelArray[1];

								// We have to set this manually since we have 3 dropdown with the same name we don't know which selected one is the correct one..
								form_data.provision.endpoint_model = endpoint_model;
								form_data.provision.endpoint_family = endpoint_family;
							}

							self.deviceSave(form_data, data, callbacks.save_success);
						} else {
							$this.removeClass('disabled');
							monster.ui.alert('error', self.i18n.active().callflows.device.there_were_errors_on_the_form);
						}
					}

				};
				
				if (data.device_type !== 'mobile') {

					$('.device-delete', device_html).click(function(ev) {
						deleteButtonEvents(ev);
					});
		
					$('#submodule-buttons-container .delete').click(function(ev) {
						deleteButtonEvents(ev);
					});
		
					function deleteButtonEvents(ev) {
						ev.preventDefault();

						monster.ui.confirm(self.i18n.active().callflows.device.are_you_sure_you_want_to_delete, function() {
							self.deviceDelete(data.data.id, callbacks.delete_success);
						});

					};

				}

				device_html.find('#sip_method').on('change', function() {
					if ($('#sip_method option:selected', device_html).val() === 'ip') {
						$('#ip_block', device_html).slideDown();
						$('#username_block', device_html).slideUp();
					} else {
						$('#username_block', device_html).slideDown();
						$('#ip_block', device_html).slideUp();
					}
				});

				$('#music_on_hold_media_id', device_html).change(function() {
					!$('#music_on_hold_media_id option:selected', device_html).val() ? $('#edit_link_media', device_html).hide() : $('#edit_link_media', device_html).show();

					device_html.find('.shoutcast-div').toggleClass('active', $(this).val() === 'shoutcast');
				});

				$('.inline_action_media', device_html).click(function(ev) {
					var _data = ($(this).data('action') === 'edit') ? { id: $('#music_on_hold_media_id', device_html).val() } : {},
						_id = _data.id;

					ev.preventDefault();

					monster.pub('callflows.media.editPopup', {
						data: _data,
						callback: function(media) {
							/* Create */
							if (!_id) {
								$('#music_on_hold_media_id', device_html).append('<option id="' + media.id + '" value="' + media.id + '">' + media.name + '</option>');
								$('#music_on_hold_media_id', device_html).val(media.id);

								$('#edit_link_media', device_html).show();
							} else {
								/* Update */
								if (media.hasOwnProperty('id')) {
									$('#music_on_hold_media_id #' + media.id, device_html).text(media.name);
								/* Delete */
								} else {
									$('#music_on_hold_media_id #' + _id, device_html).remove();
									$('#edit_link_media', device_html).hide();
								}
							}
						}
					});
				});
			} else {
				$('.media_tabs .buttons', device_html).click(function() {
					var $this = $(this);
					$('.media_pane', device_html).show();

					if (!$this.hasClass('current')) {
						$('.media_tabs .buttons').removeClass('current');
						$this.addClass('current');

						data.data.device_type = $this.attr('device_type');

						self.deviceFormatData(data);

						self.deviceRender(data, $('.media_pane', device_html), callbacks);
					}
				});
			}
		},

		deviceSetProvisionerStuff: function(device_html, data) {
			var self = this,
				set_value = function(brand_name, model_family, model_name) {
					device_html.find('.dropdown_family').hide();
					if (brand_name in data.field_data.provisioner.brands) {
						device_html.find('#dropdown_brand').val(brand_name);
						device_html
							.find('.dropdown_family[data-brand="' + brand_name + '"]')
								.css('display', 'inline-block')
								.val(model_family + '.' + model_name);
					}
				},
				provisionData = _
					.chain(data.data.provision)
					.pick([
						'endpoint_brand',
						'endpoint_family',
						'endpoint_model'
					])
					.mapValues(_.toLower)
					.value(),
				regex_brands = {
					'00085d': 'aastra',
					'0010bc': 'aastra',
					'00036b': 'cisco',
					'00000c': 'cisco',
					'000142': 'cisco',
					'000143': 'cisco',
					'000163': 'cisco',
					'000164': 'cisco',
					'000196': 'cisco',
					'000197': 'cisco',
					'0001c7': 'cisco',
					'0001c9': 'cisco',
					'000f23': 'cisco',
					'0013c4': 'cisco',
					'0016c8': 'cisco',
					'001818': 'cisco',
					'00175a': 'cisco',
					'001795': 'cisco',
					'001A2f': 'cisco',
					'001c58': 'cisco',
					'001dA2': 'cisco',
					'002155': 'cisco',
					'000e84': 'cisco',
					'000e38': 'cisco',
					'00070e': 'cisco',
					'001bd4': 'cisco',
					'001930': 'cisco',
					'0019aa': 'cisco',
					'001d45': 'cisco',
					'001ef7': 'cisco',
					'000e08': 'cisco',
					'1cdf0f': 'cisco',
					'e05fb9': 'cisco',
					'5475d0': 'cisco',
					'c46413': 'cisco',
					'000Ffd3': 'digium',
					'000b82': 'grandstream',
					'08000f': 'mitel',
					'1045bE': 'norphonic',
					'0050c2': 'norphonic',
					'0004f2': 'polycom',
					'00907a': 'polycom',
					'000413': 'snom',
					'001f9f': 'thomson',
					'00147f': 'thomson',
					'642400': 'xorcom',
					'001565': 'yealink'
				};

			set_value(provisionData.endpoint_brand, provisionData.endpoint_family, provisionData.endpoint_model);

			device_html.find('#dropdown_brand').on('change', function() {
				set_value($(this).val());
			});

			device_html.find('#mac_address').on('keyup', function() {
				var mac_address = $(this).val().replace(/[^0-9a-fA-F]/g, '');

				if (mac_address in regex_brands) {
					set_value(regex_brands[mac_address]);
				}
			});
		},

		deviceFormatData: function(data) {
			if (data.data.device_type === 'smartphone' || data.data.device_type === 'landline' || data.data.device_type === 'cellphone') {
				data.data.call_forward = {
					enabled: true,
					require_keypress: true,
					keep_caller_id: true
				};
			} else {
				data.data.call_forward = {
					enabled: false
				};
			}

			if (data.data.device_type === 'sip_uri') {
				data.data.sip.invite_format = 'route';
			}

			if (data.data.device_type === 'mobile') {
				if (!('mobile' in data.data)) {
					data.data.mobile = {
						mdn: ''
					};
				}
			}

			if (data.data.device_type === 'fax') {
				data.data.media.fax_option = true;
				data.data.media.fax.option = 'true';
			} else {
				data.data.media.fax_option = false;
				data.data.media.fax.option = 'false';
			}
		},

		deviceMigrateData: function(data) {
			var self = this;

			if (data.hasOwnProperty('media') && data.media.hasOwnProperty('audio') && data.media.audio.hasOwnProperty('codecs')) {
				var mapMigrateCodec = {
						'Speex': 'speex@16000h',
						'G722_16': 'G7221@16000h',
						'G722_32': 'G7221@32000h',
						'CELT_48': 'CELT@48000h',
						'CELT_64': 'CELT@64000h'
					},
					newCodecList = [];

				_.each(data.media.audio.codecs, function(codec) {
					mapMigrateCodec.hasOwnProperty(codec) ? newCodecList.push(mapMigrateCodec[codec]) : newCodecList.push(codec);
				});

				data.media.audio.codecs = newCodecList;
			}

			if (data.device_type === 'cell_phone') {
				data.device_type = 'cellphone';
			}

			if (typeof data.media === 'object' && typeof data.media.fax === 'object' && 'codecs' in data.media.fax) {
				delete data.media.fax.codecs;
			}

			if ('status' in data) {
				data.enabled = data.status;
				delete data.status;
			}

			if (data.hasOwnProperty('ignore_complete_elsewhere')) {
				data.ignore_completed_elsewhere = data.ignore_complete_elsewhere;

				delete data.ignore_complete_elsewhere;
			}

			return data;
		},

		deviceNormalizeData: function(data, form_data) {
			var self = this;

			if (data.hasOwnProperty('provision')) {
				if (data.provision.endpoint_brand === 'none') {
					delete data.provision;
				} else {
					if (data.provision.voicemail_beep !== 0) {
						delete data.provision.voicemail_beep;
					}
				}
			}

			if (data.hasOwnProperty('media') && data.media.hasOwnProperty('fax_option') && data.media.fax_option === 'auto') {
				delete data.media.fax_option;
			}

			if ('media' in data && 'fax' in data.media && 'fax_option' in data.media) {
				data.media.fax.option = data.media.fax_option.toString();
			}

			if ('media' in data && 'secure_rtp' in data.media) {
				delete data.media.secure_rtp;
			}

			if ('media' in data && 'bypass_media' in data.media) {
				delete data.media.bypass_media;
			}

			self.compactObject(data.caller_id);

			if (_.isEmpty(data.caller_id)) {
				delete data.caller_id;
			}

			if (!data.music_on_hold.media_id) {
				delete data.music_on_hold.media_id;
			}

			if (!data.owner_id) {
				delete data.owner_id;
			}

			if ($.isEmptyObject(data.call_forward)) {
				delete data.call_forward;
			}

			if (!data.mac_address) {
				delete data.mac_address;
			}

			if (data.sip.method !== 'ip') {
				delete data.sip.ip;
			}		

			if (data.pusher_details) {
				if(data.pusher_details.delete) {
					delete data.push
				}
				delete data.pusher_details;
			}

			if (typeof data.outbound_flags === 'string') {
				data.outbound_flags = data.outbound_flags.split(/,/);

				/* Get rid of empty string */
				var new_flags = [];
				$.each(data.outbound_flags, function(k, v) {
					if (v.replace(/\s/g, '') !== '') {
						new_flags.push(v);
					}
				});
				data.outbound_flags = new_flags;
			}
			if (data.device_type === 'fax') {
				if (!('outbound_flags' in data)) {
					data.outbound_flags = ['fax'];
				} else if (data.outbound_flags.indexOf('fax') < 0) {
					data.outbound_flags.splice(0, 0, 'fax');
				}
			}

			// support distinctive ringtone dropdown if enabled
			if (miscSettings.deviceDistinctiveRingtones) {

				if (data.ringtones.distinctive == 'enabled') {
					data.ringtones.internal = 'alert-internal';
					data.ringtones.external = 'alert-external';
				}

				else {
					delete data.ringtones.internal;
					delete data.ringtones.external;
				}
				
				delete data.ringtones.distinctive
			
			}

			else {
				
				if (data.ringtones && 'internal' in data.ringtones && data.ringtones.internal === '') {
					delete data.ringtones.internal;
				}

				if (data.ringtones && 'external' in data.ringtones && data.ringtones.external === '') {
					delete data.ringtones.external;
				}

			}

			// For devices who don't have sip creds, we need to use username, for sip url we already set it to "route", and for the others, the default is applied: "contact"
			if ($.inArray(data.device_type, ['landline', 'cellphone']) >= 0) {
				data.sip.invite_format = 'username';
			}

			if ($.inArray(data.device_type, ['fax', 'mobile', 'softphone', 'sip_device', 'smartphone']) < 0) {
				delete data.call_restriction;
			}

			if (data.hasOwnProperty('presence_id') && data.presence_id === '') {
				delete data.presence_id;
			}

			// add support for setting dnd doc for phone only devices
			if ((dimensionDeviceType.communal && miscSettings.deviceShowCommunalPhoneNumbers)) {
				data.do_not_disturb = {
					enabled: data.do_not_disturb.enabled
				}
			}

			// add support for setting caller id privacy on doc
			if ((data.device_type == 'softphone' && dimensionDeviceType.hotdesk != true || false ) || (data.device_type == 'sip_device' && dimensionDeviceType.hotdesk != true || false ) || data.device_type == 'fax' || data.device_type == 'ata') {
				if (data.caller_id_options.outbound_privacy === 'default') {
					delete data.caller_id_options;
				}
			}

			return data;
		},

		deviceCleanFormData: function(form_data) {
			if ('provision' in form_data && form_data.provision.voicemail_beep === true) {
				form_data.provision.voicemail_beep = 0;
			}

			if (form_data.mac_address) {
				form_data.mac_address = form_data.mac_address.toLowerCase();

				if (form_data.mac_address.match(/^(((\d|([a-f]|[A-F])) {2}-) {5}(\d|([a-f]|[A-F])) {2})$/)) {
					form_data.mac_address = form_data.mac_address.replace(/-/g, ':');
				} else if (form_data.mac_address.match(/^(((\d|([a-f]|[A-F])) {2}) {5}(\d|([a-f]|[A-F])) {2})$/)) {
					form_data.mac_address = form_data.mac_address.replace(/(.{2})/g, '$1:').slice(0, -1);
				}
			}

			/*
			if (form_data.caller_id) {
				form_data.caller_id.internal.number = form_data.caller_id.internal.number.replace(/\s|\(|\)|-|\./g, '');
				form_data.caller_id.external.number = form_data.caller_id.external.number.replace(/\s|\(|\)|-|\./g, '');
				form_data.caller_id.emergency.number = form_data.caller_id.emergency.number.replace(/\s|\(|\)|-|\./g, '');

				if (!_.chain(form_data.caller_id).get('asserted.number', '').isEmpty().value()) {
					form_data.caller_id.asserted.number = monster.util.getFormatPhoneNumber(form_data.caller_id.asserted.number).e164Number;
				}
			}
			*/
			
			if (form_data.caller_id) {
				
				if (!_.chain(form_data.caller_id).get('internal.number', '').isEmpty().value()) {
					form_data.caller_id.internal.number = form_data.caller_id.internal.number.replace(/\s|\(|\)|-|\./g, '');
				}
			
				if (!_.chain(form_data.caller_id).get('external.number', '').isEmpty().value()) {
					form_data.caller_id.external.number = form_data.caller_id.external.number.replace(/\s|\(|\)|-|\./g, '');
				}
			
				form_data.caller_id.emergency.number = form_data.caller_id.emergency.number.replace(/\s|\(|\)|-|\./g, '');
			
				if (!_.chain(form_data.caller_id).get('asserted.number', '').isEmpty().value()) {
					form_data.caller_id.asserted.number = monster.util.getFormatPhoneNumber(form_data.caller_id.asserted.number).e164Number;
				}

			}



			if ('media' in form_data && 'audio' in form_data.media) {
				form_data.media.audio.codecs = $.map(form_data.media.audio.codecs, function(val) { return (val) ? val : null; });
			}

			if ('media' in form_data && 'video' in form_data.media) {
				form_data.media.video.codecs = $.map(form_data.media.video.codecs, function(val) { return (val) ? val : null; });
			}

			if (form_data.device_type === 'smartphone' || form_data.device_type === 'landline' || form_data.device_type === 'cellphone') {
				form_data.call_forward.number = form_data.call_forward.number.replace(/\s|\(|\)|-|\./g, '');
				form_data.enabled = form_data.call_forward.enabled;
			}

			if ('extra' in form_data && form_data.extra.notify_unregister === true) {
				form_data.suppress_unregister_notifications = false;
			} else {
				form_data.suppress_unregister_notifications = true;
			}

			/*
			if ('extra' in form_data && 'closed_groups' in form_data.extra) {
				form_data.call_restriction.closed_groups = { action: form_data.extra.closed_groups ? 'deny' : 'inherit' };
			}
			*/

			if (!miscSettings.hideClosedGroups) {
				if ('extra' in form_data && 'closed_groups' in form_data.extra) {
					var selectedOptionValue = $('select[name="call_restriction.closed_groups.action"]').val();
					form_data.call_restriction.closed_groups = {
						action: selectedOptionValue === 'deny' ? 'deny' : 'inherit'
					}
				}
			}

			if ($.inArray(form_data.device_type, ['sip_device', 'mobile', 'softphone']) > -1) {
				if ('extra' in form_data) {
					form_data.media.encryption = form_data.media.encryption || {};

					if ($.inArray(form_data.extra.encryptionMethod, ['srtp', 'zrtp']) > -1) {
						form_data.media.encryption.enforce_security = true;
						form_data.media.encryption.methods = [form_data.extra.encryptionMethod];
					} else {
						form_data.media.encryption.methods = [];
						form_data.media.encryption.enforce_security = false;
					}
				}
			}

			if (form_data.device_type === 'teammate') {
				form_data.caller_id_options = {
					outbound_privacy: 'none'
				};
				form_data.ignore_completed_elsewhere = false;
				form_data.media = {
					audio: {
						codecs: ['PCMU', 'PCMA']
					},
					encryption: {
						enforce_security: true,
						methods: ['srtp']
					},
					webrtc: false
				};
			}

			delete form_data.extra;

			return form_data;
		},

		deviceFixArrays: function(data, data2) {
			if (typeof data.media === 'object' && typeof data2.media === 'object') {
				(data.media.audio || {}).codecs = (data2.media.audio || {}).codecs;
				(data.media.video || {}).codecs = (data2.media.video || {}).codecs;
			}

			if ('media' in data2 && 'encryption' in data2.media && 'methods' in data2.media.encryption) {
				data.media.encryption = data.media.encryption || {};
				data.media.encryption.methods = data2.media.encryption.methods;
			}

			return data;
		},

		deviceSave: function(form_data, data, success) {

			if ((dimensionDeviceType.communal && miscSettings.deviceShowCommunalPhoneNumbers)) {
				var	self = this, 
					callflowNumbers = data.field_data.callflow_numbers,
					formNumbers = (data.field_data.extension_numbers || []).concat(form_data.phone_numbers || []),
					deviceCallflow = data.field_data.device_callflow;

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

				// patch users callflow if there is a change to the qty of numbers 
				if (formNumbers.length > 0 && formNumbers.length != callflowNumbers.length) {
					self.callApi({
						resource: 'callflow.patch',
						data: {
							accountId: self.accountId,
							callflowId: deviceCallflow,
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
								console.log('Device Callflow Updated', _callflow_update)
							}
						}
					})
				}
			}

			var self = this,
				id = (typeof data.data === 'object' && data.data.id) ? data.data.id : undefined,
				normalized_data = self.deviceFixArrays(self.deviceNormalizeData($.extend(true, {}, data.data, form_data)), form_data);

			if (id) {
				self.deviceUpdate(normalized_data, function(_data, status) {
					success && success(_data, status, 'update');
				});
			} else {
				self.deviceCreate(normalized_data, function(_data, status) {
					success && success(_data, status, 'create');
				});
			}

		},

		deviceList: function(callback, deviceType) {
			var self = this;

			var deviceFilters = {
				paginate: false
			};

			// are custom callflow actions are enabled
			if (miscSettings.enableCustomCallflowActions) {
				
				// filter returned devices on default device action
				if (deviceType === 'default') {
					var hideDeviceType = [];
					var hideDimensionDeviceType = [];
				
					var deviceType = [
						{ 
							setting: miscSettings.deviceActionHideCellphoneDevices, 
							type: 'cellphone' 
						},
						{ 
							setting: miscSettings.deviceActionHideSmartphoneDevices, 
							type: 'smartphone' 
						},
						{ 
							setting: miscSettings.deviceActionHideLandlineDevices, 
							type: 'landline' 
						},
						{ 
							setting: miscSettings.deviceActionHideSoftphoneDevices, 
							type: 'softphone' 
						},
						{ 
							setting: miscSettings.deviceActionHideFaxDevices, 
							type: 'fax' 
						},
						{ 
							setting: miscSettings.deviceActionHideAtaDevices, 
							type: 'ata'
						},
						{ 
							setting: miscSettings.deviceActionHideSipUriDevices, 
							type: 'sip_uri' 
						}
					];
				
					var dimensionDeviceType = [
						{ 
							setting: miscSettings.deviceActionHideHotdeskBaseDevices, 
							type: 'hotdesk' 
						},
						{ 
							setting: miscSettings.deviceActionHideCommunalDevices, 
							type: 'communal' 
						},
						{ 
							setting: miscSettings.deviceActionHideLegacyPbxDevices, 
							type: 'legacypbx' 
						}
					];
				
					deviceType.forEach(device => {
						if (device.setting) {
							hideDeviceType.push(device.type);
						}
					});
				
					dimensionDeviceType.forEach(device => {
						if (device.setting) {
							hideDimensionDeviceType.push(device.type);
						}
					});
				
					if (hideDeviceType.length > 0) {
						deviceFilters['filter_not_device_type'] = hideDeviceType;
					}
				
					if (hideDimensionDeviceType.length > 0) {
						deviceFilters['filter_not_dimension.type'] = hideDimensionDeviceType;
					}
				}
				
				// filter returned devices when using custom device action
				let validDeviceTypes = ['cellphone', 'smartphone', 'landline', 'softphone', 'fax', 'ata', 'sip_uri'];

				if (validDeviceTypes.includes(deviceType)) {
					deviceFilters['filter_device_type'] = deviceType;
				}

			}

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: deviceFilters
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});

		},

		deviceGet: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.get',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'device.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'device.update',
				data: {
					accountId: self.accountId,
					deviceId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceDelete: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.delete',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		deviceGetDataProvisoner: function(callback) {
			var self = this;

			monster.request({
				resource: 'callflows.device.getProvisionerPhones',
				data: {
				},
				success: function(data) {
					data = self.deviceFormatDataProvisioner(data.data);

					callback && callback(data);
				}
			});
		},

		deviceFormatDataProvisioner: function(data) {
			var self = this,
				formattedData = {
					brands: data
				};

			return formattedData;
		},

		deviceDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			// set variables for use elsewhere
			hideAdd = args.hideAdd;
			hideClassifiers = args.hideClassifiers,
			miscSettings = args.miscSettings,
			hideDeviceTypes = args.hideDeviceTypes
			deviceAudioCodecs = args.deviceAudioCodecs,
			deviceVideoCodecs = args.deviceVideoCodecs,
			hideCallflowAction = args.hideCallflowAction,
			pusherApps = args.pusherApps;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				// custom callflow actions
				var customActions = [
					'cellphoneDevice[id=*]',
					'smartphoneDevice[id=*]',
					'landlineDevice[id=*]',
					'softphoneDevice[id=*]',
					'faxDevice[id=*]',
					'ataDevice[id=*]',
					'sipUriDevice[id=*]'
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
			
			var deviceCategory;

			if (miscSettings.enableCallflowDeviceCategory) {
				deviceCategory = self.i18n.active().oldCallflows.device_cat;
			} else {
				deviceCategory = self.i18n.active().oldCallflows.advanced_cat;
			}

			$.extend(callflow_nodes, {
				'device[id=*]': {
					name: self.i18n.active().callflows.device.device,
					icon: 'phone',
					google_icon: 'deskphone',
					category: deviceCategory,
					module: 'device',
					tip: self.i18n.active().callflows.device.device_tip,
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
					isListed: determineIsListed('device[id=*]'),
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this
							deviceType = 'default';

						self.deviceList(function(devices) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(devices, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: devices,
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
											items: _.sortBy(devices, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'device'
								}));

								var selector = popup_html.find('#device_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#device_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');
								
								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#device_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#device_selector', popup_html).change(toggleSaveButton);

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

								if ($('#device_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#device_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.devicePopupEdit({
										data: _data,
										callback: function(device) {
											node.setMetadata('id', device.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

											node.caption = device.name || '';

											popup.dialog('close');
										}
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#device_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = $('#device_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.device.device_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, deviceType);

					},
					listEntities: function(callback) {
						var getDeviceWithTemplate = function(device) {
								var type = device.device_type,
									dataToTemplate = _.merge({
										iconCssClass: getIconCssClass(type),
										statusCssClass: getStatusCssClass(device),
										type: type
									}, _.pick(device, [
										'name'
									]));

								return _.merge({
									customEntityTemplate: self.getTemplate({
										name: 'entity-element',
										data: dataToTemplate,
										submodule: 'device'
									})
								}, device);
							},
							getIconCssClass = function(type) {
								return _.get({
									'cellphone': 'phone',
									'smartphone': 'device-mobile',
									'landline': 'home',
									'mobile': 'device-sprint-phone',
									'softphone': 'device-soft-phone',
									'sip_device': 'device-voip-phone',
									'sip_uri': 'device-voip-phone',
									'teammate': 'device-mst',
									'fax': 'device-fax',
									'ata': 'device-ata'
								}, type, 'dot');
							},
							getStatusCssClass = function(device) {
								return !device.enabled ? ''
									: self.isDeviceCallable(device) ? 'monster-green'
									: 'monster-red';
							};

						monster.waterfall([
							function(callback) {
								self.callApi({
									resource: 'device.list',
									data: {
										accountId: self.accountId,
										filters: {
											with_status: true,
											paginate: false
										}
									},
									success: function(data, status) {
										callback && callback(null, data.data);
									}
								});
							}
						],
						function(err, devices) {
							callback && callback(_.map(devices, getDeviceWithTemplate));
						});
					},
					editEntity: 'callflows.device.edit'
				},
				'cellphoneDevice[id=*]': {
					name: self.i18n.active().callflows.cellphoneDevice.device,
					icon: 'active_phone',
					google_icon: 'smartphone',
					category: deviceCategory,
					module: 'device',
					tip: self.i18n.active().callflows.cellphoneDevice.device_tip,
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
					isListed: determineIsListed('cellphoneDevice[id=*]'),
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							deviceType = 'cellphone';

						self.deviceList(function(devices) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(devices, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: devices,
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
									name: 'callflowCellphoneEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										hideAdd: args.hideAdd,
										can_call_self: node.getMetadata('can_call_self') || false,
										parameter: {
											name: 'timeout (s)',
											value: node.getMetadata('timeout') || '20'
										},
										objects: {
											items: _.sortBy(devices, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'device'
								}));

								var selector = popup_html.find('#device_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#device_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#device_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#device_selector', popup_html).change(toggleSaveButton);

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

								if ($('#device_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#device_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.devicePopupEdit({
										data: _data,
										callback: function(device) {
											node.setMetadata('id', device.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

											node.caption = device.name || '';

											popup.dialog('close');
										}
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#device_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = $('#device_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.cellphoneDevice.device_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, deviceType);
					},
					editEntity: 'callflows.device.edit'
				},
				'smartphoneDevice[id=*]': {
					name: self.i18n.active().callflows.smartphoneDevice.device,
					icon: 'active_phone',
					google_icon: 'smartphone',
					category: deviceCategory,
					module: 'device',
					tip: self.i18n.active().callflows.smartphoneDevice.device_tip,
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
					isListed: determineIsListed('smartphoneDevice[id=*]'),
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							deviceType = 'smartphone';

						self.deviceList(function(devices) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(devices, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: devices,
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
									name: 'callflowSmartphoneEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										hideAdd: args.hideAdd,
										can_call_self: node.getMetadata('can_call_self') || false,
										parameter: {
											name: 'timeout (s)',
											value: node.getMetadata('timeout') || '20'
										},
										objects: {
											items: _.sortBy(devices, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'device'
								}));

								var selector = popup_html.find('#device_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#device_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#device_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#device_selector', popup_html).change(toggleSaveButton);

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

								if ($('#device_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#device_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.devicePopupEdit({
										data: _data,
										callback: function(device) {
											node.setMetadata('id', device.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

											node.caption = device.name || '';

											popup.dialog('close');
										}
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#device_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = $('#device_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.smartphoneDevice.device_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, deviceType);
					},
					editEntity: 'callflows.device.edit'
				},
				'landlineDevice[id=*]': {
					name: self.i18n.active().callflows.landlineDevice.device,
					icon: 'active_phone',
					google_icon: 'home_work',
					category: deviceCategory,
					module: 'device',
					tip: self.i18n.active().callflows.landlineDevice.device_tip,
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
					isListed: determineIsListed('landlineDevice[id=*]'),
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							deviceType = 'landline';

						self.deviceList(function(devices) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(devices, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: devices,
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
									name: 'callflowLandlineEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										hideAdd: args.hideAdd,
										can_call_self: node.getMetadata('can_call_self') || false,
										parameter: {
											name: 'timeout (s)',
											value: node.getMetadata('timeout') || '20'
										},
										objects: {
											items: _.sortBy(devices, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'device'
								}));

								var selector = popup_html.find('#device_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#device_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#device_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#device_selector', popup_html).change(toggleSaveButton);

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

								if ($('#device_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#device_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.devicePopupEdit({
										data: _data,
										callback: function(device) {
											node.setMetadata('id', device.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

											node.caption = device.name || '';

											popup.dialog('close');
										}
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#device_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = $('#device_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.landlineDevice.device_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, deviceType);
					},
					editEntity: 'callflows.device.edit'
				},
				'softphoneDevice[id=*]': {
					name: self.i18n.active().callflows.softphoneDevice.device,
					icon: 'phone',
					google_icon: 'devices',
					category: deviceCategory,
					module: 'device',
					tip: self.i18n.active().callflows.softphoneDevice.device_tip,
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
					isListed: determineIsListed('softphoneDevice[id=*]'),
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							deviceType = 'softphone';

						self.deviceList(function(devices) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(devices, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: devices,
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
									name: 'callflowSoftphoneEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										hideAdd: args.hideAdd,
										can_call_self: node.getMetadata('can_call_self') || false,
										parameter: {
											name: 'timeout (s)',
											value: node.getMetadata('timeout') || '20'
										},
										objects: {
											items: _.sortBy(devices, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'device'
								}));

								var selector = popup_html.find('#device_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#device_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#device_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#device_selector', popup_html).change(toggleSaveButton);

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

								if ($('#device_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#device_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.devicePopupEdit({
										data: _data,
										callback: function(device) {
											node.setMetadata('id', device.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

											node.caption = device.name || '';

											popup.dialog('close');
										}
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#device_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = $('#device_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.softphoneDevice.device_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, deviceType);
					},
					editEntity: 'callflows.device.edit'
				},
				'faxDevice[id=*]': {
					name: self.i18n.active().callflows.faxDevice.device,
					icon: 'phone',
					google_icon: 'fax',
					category: deviceCategory,
					module: 'device',
					tip: self.i18n.active().callflows.faxDevice.device_tip,
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
					isListed: determineIsListed('faxDevice[id=*]'),
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							deviceType = 'fax';

						self.deviceList(function(devices) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(devices, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: devices,
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
									name: 'callflowFaxEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										hideAdd: args.hideAdd,
										can_call_self: node.getMetadata('can_call_self') || false,
										parameter: {
											name: 'timeout (s)',
											value: node.getMetadata('timeout') || '20'
										},
										objects: {
											items: _.sortBy(devices, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'device'
								}));

								var selector = popup_html.find('#device_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#device_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#device_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#device_selector', popup_html).change(toggleSaveButton);

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

								if ($('#device_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#device_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.devicePopupEdit({
										data: _data,
										callback: function(device) {
											node.setMetadata('id', device.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

											node.caption = device.name || '';

											popup.dialog('close');
										}
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#device_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = $('#device_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.faxDevice.device_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, deviceType);
					},
					editEntity: 'callflows.device.edit'
				},
				'ataDevice[id=*]': {
					name: self.i18n.active().callflows.ataDevice.device,
					icon: 'phone',
					google_icon: 'settop_component',
					category: deviceCategory,
					module: 'device',
					tip: self.i18n.active().callflows.ataDevice.device_tip,
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
					isListed: determineIsListed('ataDevice[id=*]'),
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							deviceType = 'ata';

						self.deviceList(function(devices) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(devices, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: devices,
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
									name: 'callflowAtaEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										hideAdd: args.hideAdd,
										can_call_self: node.getMetadata('can_call_self') || false,
										parameter: {
											name: 'timeout (s)',
											value: node.getMetadata('timeout') || '20'
										},
										objects: {
											items: _.sortBy(devices, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'device'
								}));

								var selector = popup_html.find('#device_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#device_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#device_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#device_selector', popup_html).change(toggleSaveButton);

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

								if ($('#device_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#device_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.devicePopupEdit({
										data: _data,
										callback: function(device) {
											node.setMetadata('id', device.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

											node.caption = device.name || '';

											popup.dialog('close');
										}
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#device_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = $('#device_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.ataDevice.device_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, deviceType);
					},
					editEntity: 'callflows.device.edit'
				},
				'sipUriDevice[id=*]': {
					name: self.i18n.active().callflows.sipUriDevice.device,
					icon: 'phone',
					google_icon: 'sip',
					category: deviceCategory,
					module: 'device',
					tip: self.i18n.active().callflows.sipUriDevice.device_tip,
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
					isListed: determineIsListed('sipUriDevice[id=*]'),
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							deviceType = 'sip_uri';

						self.deviceList(function(devices) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(devices, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: devices,
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
									name: 'callflowSipUriEdit',
									data: {
										hideFromCallflowAction: args.hideFromCallflowAction,
										hideAdd: args.hideAdd,
										can_call_self: node.getMetadata('can_call_self') || false,
										parameter: {
											name: 'timeout (s)',
											value: node.getMetadata('timeout') || '20'
										},
										objects: {
											items: _.sortBy(devices, 'name'),
											selected: node.getMetadata('id') || ''
										}
									},
									submodule: 'device'
								}));

								var selector = popup_html.find('#device_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Device Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#device_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#device_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#device_selector', popup_html).change(toggleSaveButton);

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

								if ($('#device_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#device_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.devicePopupEdit({
										data: _data,
										callback: function(device) {
											node.setMetadata('id', device.id || 'null');
											node.setMetadata('timeout', $('#parameter_input', popup_html).val());
											node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

											node.caption = device.name || '';

											popup.dialog('close');
										}
									});
								});

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#device_selector', popup_html).val());
									node.setMetadata('timeout', $('#parameter_input', popup_html).val());
									node.setMetadata('can_call_self', $('#device_can_call_self', popup_html).is(':checked'));

									node.caption = $('#device_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.sipUriDevice.device_title,
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, deviceType);
					},
					editEntity: 'callflows.device.edit'
				}
			});
		},

		deviceRenderNumberList: function(data, parent) {
			var self = this,
				parent = $('#phone_numbers_container', parent);
				
				if (miscSettings.enableConsoleLogging) {
					console.log('Device Data', data)
				}

				var phone_numbers = data.field_data.phone_numbers

				$('.numberRows', parent).empty();

				var numberRow_html = $(self.getTemplate({
					name: 'numberRow',
					data: {
						phone_numbers
					},
					submodule: 'device'
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

		deviceSubmoduleButtons: function(data) {
			var existingItem = true,
				hideDelete = false;
			
			if (!data.id) {
				existingItem = false;
			}

			if (hideAdd.device || dimensionDeviceType.preventDelete) {
				hideDelete = true;
			}

			var self = this,
				buttons = $(self.getTemplate({
					name: 'submoduleButtons',
					data: {
						miscSettings: miscSettings,
						existingItem: existingItem,
						hideDelete: hideDelete
					}
				}));
			
			$('.entity-header-buttons').empty();
			$('.entity-header-buttons').append(buttons);

			if (!data.id) {
				$('.delete', '.entity-header-buttons').addClass('disabled');
			}
		},

		// linkedColumns added from monster.ui.js to support customDeviceCodecSelector
		linkedColumns: function(target, items, selectedItems, pOptions) {
			var self = this,
				coreApp = monster.apps.core,
				defaultOptions = {
					insertionType: 'appendTo',
					searchable: true,
					i18n: {
						search: coreApp.i18n.active().search,
						columnsTitles: {
							available: coreApp.i18n.active().linkedColumns.available,
							selected: coreApp.i18n.active().linkedColumns.selected
						}
					}
				},
				unselectedItems = (function findUnselectedItems(items, selectedItems) {
					var selectedKeys = selectedItems.map(function(item) { return item.key; }),
						unselectedItems = items.filter(function(item) { return selectedKeys.indexOf(item.key) < 0; });

					return unselectedItems;
				})(items, selectedItems),
				options = $.extend(true, defaultOptions, pOptions || {}),
				dataTemplate = {
					unselectedItems: unselectedItems,
					selectedItems: selectedItems,
					options: options
				},
				widgetTemplate = $(monster.template(coreApp, 'linkedColumns-template', dataTemplate)),
				widget;

			widgetTemplate
				.find('.available, .selected')
					.sortable({
						items: '.item-selector',
						connectWith: '.connected',
						tolerance: 'pointer'
					});

			widgetTemplate.find('.available, .selected').on('dblclick', '.item-selector', function() {
				var newColumnClass = $(this).parent().hasClass('available') ? '.selected' : '.available';

				$(this).appendTo(widgetTemplate.find(newColumnClass));
			});

			if (options.searchable) {
				widgetTemplate
					.find('.search-wrapper')
						.on('keyup', function(event) {
							event.preventDefault();

							var $this = $(this),
								$input = $this.find('input'),
								searchString = $input.val().toLowerCase(),
								items = $(this).siblings('ul').find('.item-selector');

							_.each(items, function(item) {
								var $item = $(item),
									value = $item.find('.item-value').html().toLowerCase();

								value.indexOf(searchString) < 0 ? $item.hide() : $item.show();
							});
						});
			}

			widget = widgetTemplate[options.insertionType](target);

			widget.getSelectedItems = function getSelectedItems() {
				var results = [];

				widgetTemplate.find('ul.selected .item-selector').each(function(k, item) {
					results.push($(item).data('key'));
				});

				return results;
			};

			return widget;
		},
		
		// modified monster.ui.codecSelector to support specifying which codecs are avaialble
		customDeviceCodecSelector: function(type, target, selectedCodecs, customCodecs, options) {

			var availableCodecs = customCodecs.availableCodecs;

			var self = this,
				codecsI18n = monster.apps.core.i18n.active().codecs,
				defaultAudioList = {
					'AMR-WB': codecsI18n.audio['AMR-WB'],
					'AMR': codecsI18n.audio.AMR,
					'CELT@32000h': codecsI18n.audio['CELT@32000h'],
					'CELT@48000h': codecsI18n.audio['CELT@48000h'],
					'CELT@64000h': codecsI18n.audio['CELT@64000h'],
					'G722': codecsI18n.audio.G722,
					'G729': codecsI18n.audio.G729,
					'G7221@16000h': codecsI18n.audio['G7221@16000h'],
					'G7221@32000h': codecsI18n.audio['G7221@32000h'],
					'GSM': codecsI18n.audio.GSM,
					'OPUS': codecsI18n.audio.OPUS,
					'PCMA': codecsI18n.audio.PCMA,
					'PCMU': codecsI18n.audio.PCMU,
					'speex@16000h': codecsI18n.audio['speex@16000h'],
					'speex@32000h': codecsI18n.audio['speex@32000h']
				},
				defaultVideoList = {
					'H261': codecsI18n.video.H261,
					'H263': codecsI18n.video.H263,
					'H264': codecsI18n.video.H264,
					'VP8': codecsI18n.video.VP8
				},
				mapMigrateAudioCodec = {
					'CELT_48': 'CELT@48000h',
					'CELT_64': 'CELT@64000h',
					'G722_16': 'G7221@16000h',
					'G722_32': 'G7221@32000h',
					'Speex': 'speex@16000h'
				},
				mapMigrateVideoCodec = {},
				selectedItems = [],
				items = [],
				getLinkedColumn = function(selectedCodecs, defaultList, mapMigrate) {
					selectedItems = _.map(selectedCodecs, function(codec) {
						return {
							key: codec,
							// if codec is in the default List, get its i18n, if it's not, check if it's not an outdated modem from the migrate list, if it is, take the new value and its i18n, if not, just display the codec as it is stored in the db
							value: defaultList.hasOwnProperty(codec) ? defaultList[codec] : (mapMigrate.hasOwnProperty(codec) ? defaultList[mapMigrate[codec]] : codec)
						};
					});
		
					items = _.map(defaultList, function(description, codec) {
						return {
							key: codec,
							value: description
						};
					}).sort(function(a, b) {
						return a.value > b.value ? 1 : -1;
					});
		
					return self.linkedColumns(target, items, selectedItems, options);
				};
		
			if (type === 'audio') {
				return getLinkedColumn(selectedCodecs, availableCodecs || defaultAudioList, mapMigrateAudioCodec);
			} else if (type === 'video') {
				return getLinkedColumn(selectedCodecs, availableCodecs || defaultVideoList, mapMigrateVideoCodec);
			} else {
				console.error('This is not a valid type for our codec selector: ', type);
			}

		}
		

	};

	return app;
});
