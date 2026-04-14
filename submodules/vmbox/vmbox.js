define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone'),
		hideAdd = false,
		miscSettings = {},
		anankeCallbacks = {};

	var app = {
		requests: {
			'messages.list': {
				url: 'accounts/{accountId}/vmboxes/{vmboxId}/messages',
				verb: 'GET'
			}
		},

		subscribe: {
			'callflows.fetchActions': 'vmboxDefineActions',
			'callflows.vmbox.edit': '_vmboxEdit',
			'callflows.vmbox.editPopup': 'vmboxPopupEdit',
			'callflows.voicemail.submoduleButtons': 'vmboxSubmoduleButtons'
		},

		vmboxPopupEdit: function(args) {
			var self = this,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults || {},
				popup,
				popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>');

			if (miscSettings.callflowButtonsWithinHeader) {
				miscSettings.popupEdit = true;
			}

			self.vmboxEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: (data.id) ? self.i18n.active().callflows.vmbox.edit_voicemail_box_title : self.i18n.active().callflows.vmbox.create_voicemail_box_title
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring vmboxEdit
		_vmboxEdit: function(args) {
			var self = this;
			self.vmboxEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		vmboxEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#vmbox-content'),
				target = _target || $('#vmbox-view', parent),
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
						require_pin: true,
						check_if_owner: true,
						pin: '',
						media: {},
						timezone: 'inherit'
					}, data_defaults || {}),

					field_data: {
						users: [],
						media: [],
						messages: []
					}
				};

			monster.parallel({
				media_list: function(callback) {
					self.vmboxMediaList(function(_data) {
						_data.unshift({
							id: '',
							name: self.i18n.active().callflows.vmbox.not_set
						});

						defaults.field_data.media = _data;

						callback(null, _data);
					});
				},
				user_list: function(callback) {
					self.vmboxUserList(function(_data) {
						_data.unshift({
							id: '',
							first_name: self.i18n.active().callflowsApp.common.noOwner,
							last_name: ''
						});

						defaults.field_data.users = _data;

						callback(null, _data);
					});
				},
				get_vmbox: function(callback) {
					if (typeof data === 'object' && data.id) {
						self.vmboxGet(data.id, function(_data) {
							callback(null, _data);
						});
					} else {
						callback(null, {});
					}
				},
				get_vmbox_messages: function(callback) {
					if (typeof data === 'object' && data.id) {
						self.vmboxMessagesGet(data.id, function(_data) {

							defaults.field_data.messages = _data;

							callback(null, _data);
						});
					} else {
						callback(null, {});
					}
				}
			},
			function(err, results) {
				var render_data = defaults;

				miscSettings.vmboxPreventDelete = false;

				if (results.get_vmbox.hasOwnProperty('owner_id') && results.get_vmbox.owner_id != null) {
					if (miscSettings.vmboxPreventDeletingUserAssociated) {
						miscSettings.vmboxPreventDelete = true;
					}
				}

				if (typeof data === 'object' && data.id) {
					render_data = $.extend(true, defaults, { data: results.get_vmbox });
				}

				if (miscSettings.callflowButtonsWithinHeader) {
					self.vmboxSubmoduleButtons(data);
				};

				self.vmboxRender(render_data, target, callbacks);

				if (typeof callbacks.after_render === 'function') {
					callbacks.after_render();
				}

				if (miscSettings.callflowButtonsWithinHeader) {
					miscSettings.popupEdit = false;
				}

			});

		},

		vmboxFormatData: function(data) {
			var self = this,
				transcription = monster.util.getCapability('voicemail.transcription');

			data.data.extra = data.data.extra || {};

			data.data.extra.recipients = (data.data.notify_email_addresses || []).toString();

			data.data = _.merge(data.data, {
				hasTranscribe: _.get(transcription, 'isEnabled', false),
				transcribe: _.get(data.data, 'transcribe', transcription.defaultValue),
				announcement_only: _.get(data.data, 'announcement_only', false),
				include_message_on_notify: _.get(data.data, 'include_message_on_notify', true)
			});

			if (Array.isArray(data.field_data.messages)) {
				data.field_data.messages = data.field_data.messages
					.filter(function(message) {
						// exclude messages in the 'deleted' folder
						return message.folder !== 'deleted';
					})
					.map(function(message) {
						var formattedTimestamp = monster.util.toFriendlyDate(message.timestamp),
							formattedDate = monster.util.toFriendlyDate(message.timestamp, 'date'),
							formattedTime = monster.util.toFriendlyDate(message.timestamp, 'time'),
							formattedCallerIdNumber = monster.util.formatPhoneNumber(message.caller_id_number), 
							formattedCallerIdName = message.caller_id_name === message.caller_id_number ? monster.util.formatPhoneNumber(message.caller_id_name) : message.caller_id_name,
							formattedTo = typeof message.to === 'string' ? monster.util.formatPhoneNumber(message.to.split('@')[0]) : message.to,
							formattedFolder = typeof message.folder === 'string' ? message.folder.charAt(0).toUpperCase() + message.folder.slice(1) : message.folder,
							formattedLength = formatLength(message.length);

						return _.merge({}, message, {
							timestamp: formattedTimestamp,
							date: formattedDate,
							time: formattedTime,
							caller_id_number: formattedCallerIdNumber,
							caller_id_name: formattedCallerIdName,
							to: formattedTo,
							folder: formattedFolder,
							length: formattedLength
						});
					});
			}

			// format message length from milliseconds to friendly format
			function formatLength(millisecondsString) {
				var totalSeconds = Math.floor(parseInt(millisecondsString, 10) / 1000);

				if (isNaN(totalSeconds) || totalSeconds <= 0) {
					return '0s';
				}

				var hours = Math.floor(totalSeconds / 3600),
					minutes = Math.floor((totalSeconds % 3600) / 60),
					seconds = totalSeconds % 60,
					parts = [];

				if (hours > 0) {
					parts.push(hours + 'h');
				}
				if (minutes > 0) {
					parts.push(minutes + 'm');
				}
				if (seconds > 0 || parts.length === 0) {
					parts.push(seconds + 's');
				}

				return parts.join(' ');
			}

			return data;
		},

		vmboxRender: function(data, target, callbacks) {
			var self = this,
				formattedData = self.vmboxFormatData(data),
				vmbox_html = $(self.getTemplate({
					name: 'edit',
					data: {
						...formattedData,
						hideAdd: hideAdd,
						miscSettings: miscSettings
					},
					submodule: 'vmbox'
				})),
				vmboxForm = vmbox_html.find('#vmbox-form');

			timezone.populateDropdown($('#timezone', vmbox_html), data.data.timezone || 'inherit', {inherit: self.i18n.active().defaultTimezone});

			monster.ui.validate(vmboxForm, {
				rules: {
					'mailbox': {
						required: true,
						digits: true
					},
					'pin': {
						digits: true,
						minlength: 4
					},
					'name': {
						required: true
					}
				}
			});

			$('*[rel=popover]:not([type="text"])', vmbox_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', vmbox_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(vmbox_html);

			$('#owner_id', vmbox_html).change(function() {
				if ($(this).val()) {
					self.callApi({
						resource: 'user.get',
						data: {
							accountId: self.accountId,
							userId: $(this).val()
						},
						success: function(data) {
							if ('timezone' in data.data) {
								$('#timezone', vmbox_html).val(data.data.timezone);
							}
						}
					});
				}
			});

			if (!$('#owner_id', vmbox_html).val()) {
				$('#edit_link', vmbox_html).hide();
			}

			$('#owner_id', vmbox_html).change(function() {
				if (!$('#owner_id option:selected', vmbox_html).val()) {
					$('#edit_link', vmbox_html).hide();
					$('#timezone', vmbox_html).val(timezone.getLocaleTimezone());
				} else {
					$('#edit_link', vmbox_html).show();
				}
			});

			$('.inline_action', vmbox_html).click(function(ev) {
				var _data = ($(this).data('action') === 'edit') ? { id: $('#owner_id', vmbox_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();

				monster.pub('callflows.user.popupEdit', {
					data: _data,
					callback: function(_data) {
						/* Create */
						if (!_id) {
							$('#owner_id', vmbox_html).append('<option id="' + _data.id + '" value="' + _data.id + '">' + _data.first_name + ' ' + _data.last_name + '</option>');
							$('#owner_id', vmbox_html).val(_data.id);

							$('#edit_link', vmbox_html).show();
							$('#timezone', vmbox_html).val(_data.timezone);
						} else {
							/* Update */
							if ('id' in _data) {
								$('#owner_id #' + _data.data.id, vmbox_html).text(_data.first_name + ' ' + _data.last_name);
								$('#timezone', vmbox_html).val(_data.timezone);
							} else {
								/* Delete */
								$('#owner_id #' + _id, vmbox_html).remove();
								$('#edit_link', vmbox_html).hide();
								$('#timezone', vmbox_html).val('America/Los_Angeles');
							}
						}
					}
				});
			});

			if (!$('#media_unavailable', vmbox_html).val()) {
				$('#edit_link_media', vmbox_html).hide();
			}

			$('#media_unavailable', vmbox_html).change(function() {
				!$('#media_unavailable option:selected', vmbox_html).val() ? $('#edit_link_media', vmbox_html).hide() : $('#edit_link_media', vmbox_html).show();
			});

			$('.inline_action_media', vmbox_html).click(function(ev) {
				var _data = ($(this).data('action') === 'edit') ? { id: $('#media_unavailable', vmbox_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();

				monster.pub('callflows.media.editPopup', {
					data: _data,
					callback: function(_data) {
						/* Create */
						if (!_id) {
							$('#media_unavailable', vmbox_html).append('<option id="' + _data.id + '" value="' + _data.id + '">' + _data.name + '</option>');
							$('#media_unavailable', vmbox_html).val(_data.id);

							$('#edit_link_media', vmbox_html).show();
						} else {
							/* Update */
							if ('id' in _data) {
								$('#media_unavailable #' + _data.id, vmbox_html).text(_data.name);
							} else {
								/* Delete */
								$('#media_unavailable #' + _id, vmbox_html).remove();
								$('#edit_link_media', vmbox_html).hide();
							}
						}
					}
				});
			});

			if (!$('#media_temporary_unavailable', vmbox_html).val()) {
				$('#edit_link_temporary_media', vmbox_html).hide();
			}

			$('#media_temporary_unavailable', vmbox_html).change(function() {
				!$('#media_temporary_unavailable option:selected', vmbox_html).val() ? $('#edit_link_temporary_media', vmbox_html).hide() : $('#edit_link_temporary_media', vmbox_html).show();
			});

			$('.inline_action_temporary_media', vmbox_html).click(function(ev) {
				var _data = ($(this).data('action') === 'edit') ? { id: $('#media_temporary_unavailable', vmbox_html).val() } : {},
					_id = _data.id;

				ev.preventDefault();

				monster.pub('callflows.media.editPopup', {
					data: _data,
					callback: function(_data) {
						/* Create */
						if (!_id) {
							$('#media_temporary_unavailable', vmbox_html).append('<option id="' + _data.id + '" value="' + _data.id + '">' + _data.name + '</option>');
							$('#media_temporary_unavailable', vmbox_html).val(_data.id);

							$('#edit_link_temporary_media', vmbox_html).show();
						} else {
							/* Update */
							if ('id' in _data) {
								$('#media_temporary_unavailable #' + _data.id, vmbox_html).text(_data.name);
							} else {
								/* Delete */
								$('#media_temporary_unavailable #' + _id, vmbox_html).remove();
								$('#edit_link_temporary_media', vmbox_html).hide();
							}
						}
					}
				});
			});

			$('#announcement_only', vmbox_html).click(function(ev) {
				var $this = $(this),
					isChecked = $this.prop('checked'),
					$skipInstructions = vmbox_html.find('#skip_instructions'),
					$parentDiv = $skipInstructions.parents('.inputs-list'),
					$skipInstructionsInput = vmbox_html.find('#skip_instructions_input').val(),
					isSkipInstructions = $skipInstructionsInput === 'true' ? true : false,
					isDisabled = false;

				if (isChecked) {
					isDisabled = true;
					isSkipInstructions = true;

					$parentDiv
						.addClass('disabled');
				} else {
					$parentDiv
						.removeClass('disabled');

				}

				$skipInstructions
					.prop('checked', isSkipInstructions);

				$skipInstructions
					.prop('disabled', isDisabled);
			});

			var validateEmail = function(email) {
					var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
					return re.test(email);
				},
				getRecipients = function() {
					var list = $('#recipients_list', vmbox_html).val().replace(/\s+/g, '').split(',');

					return list.filter(function(email) { return validateEmail(email); });
				};

			$('.vmbox-save', vmbox_html).click(function(ev) {
				saveButtonEvents(ev);
			});

			$('#submodule-buttons-container .save').click(function(ev) {
				saveButtonEvents(ev);
			});

			// add search to dropdown
			vmbox_html.find('#media_unavailable').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			// add search to dropdown
			vmbox_html.find('#media_temporary_unavailable').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			// add search to dropdown
			vmbox_html.find('#timezone').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			function saveButtonEvents(ev) {
				ev.preventDefault();

				var $this = $(this);

				if (!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if (monster.ui.valid(vmboxForm)) {
						var form_data = monster.ui.getFormData('vmbox-form'),
							$skipInstructionsInput = vmbox_html.find('#skip_instructions_input').val();

						if (miscSettings.enableAnankeCallbacks) {

							// clear any previous values
							if ('notify' in data.data) {
								delete data.data.notify;
							}

							var callbackEnabled = vmbox_html.find('#callback_enabled').is(':checked');

							if (callbackEnabled) {

								form_data.notify = {};
								form_data.notify.callback = [];
					
								// build callback list
								vmbox_html.find('.saved-callback-numbers .callback-entry').each(function () {
									var $entry = $(this);

									form_data.notify.callback.push({
										timeout_s: anankeCallbacks.callbackTimeout || 30,
										number: String($entry.data('number')),
										interval_s: parseInt($entry.data('interval'), 10),
										attempts: parseInt($entry.data('attempts'), 10),
										disabled: false
									});
								});

								// create schedule if not present already
								if (!('schedule' in data.data)) {
									data.data.schedule = {
										action: {
											type: "check_voicemail"
										},
										minutes: anankeCallbacks.scheduleMinutes || 5,
										type: "periodic"
									};
								}

							} else {

								// delete schedule if callback is disabled
								if ('schedule' in data.data) {
									delete data.data.schedule;
								}

							}							

						}
						
						form_data.notify_email_addresses = getRecipients();

						if (form_data.announcement_only) {
							form_data.skip_instructions = $skipInstructionsInput === 'true' ? true : false;
						}

						/* self.clean_form_data(form_data); */
						if ('field_data' in data) {
							delete data.field_data;
						}

						self.vmboxSave(form_data, data, callbacks.save_success, function() {
							$this.removeClass('disabled');
						});
					} else {
						$this.removeClass('disabled');
					}
				}
			}
			
			$('.vmbox-delete', vmbox_html).click(function(ev) {
				deleteButtonEvents(ev);
			});

			$('#submodule-buttons-container .delete').click(function(ev) {
				deleteButtonEvents(ev);
			});

			function deleteButtonEvents(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.vmbox.are_you_sure_you_want_to_delete, function() {
					self.vmboxDelete(data.data.id, callbacks.delete_success);
				});

			};

			if (miscSettings.enableAnankeCallbacks) {

				function toggleCallbackListHeader() {
					var hasEntries = vmbox_html.find('.list-callback-numbers .callback-entry').length > 0;

					if (hasEntries) {
						vmbox_html.find('.callback-list-header').attr('style', 'display: flex !important;');
					} else {
						vmbox_html.find('.callback-list-header').attr('style', 'display: none !important;');
					}

				}

				function toggleCallbackNumbers() {
					var isEnabled = vmbox_html.find('#callback_enabled').is(':checked');
					vmbox_html.find('.list-callback-numbers').toggle(isEnabled);
					toggleCallbackListHeader()
				}

				toggleCallbackNumbers();

				vmbox_html.find('#callback_enabled').on('change', function () {
					toggleCallbackNumbers();
				});

				// render callback numbers if present
				if (Array.isArray(data.data.notify?.callback)) {
					var callback_html;

					data.data.notify.callback.forEach(function (entry) {
						callback_html = $(self.getTemplate({
							name: 'callbackNumbers',
							data: {
								number: entry.number,
								interval: entry.interval_s,
								attempts: entry.attempts
							},
							submodule: 'vmbox'
						}));

						vmbox_html.find('.list-callback-numbers .saved-callback-numbers').append(callback_html);
					});
					toggleCallbackListHeader();
				}
				
				var addCallback = function () {
					var callback_html;
						
					var number = vmbox_html.find('#callback_number').val().trim(),
						interval = vmbox_html.find('#callback_interval').val().trim(),
						attempts = vmbox_html.find('#callback_attempts').val().trim();

					if (number && interval && attempts) {

						var exists = false;

						// check if the number has already been added to the list
						vmbox_html.find('.saved-callback-numbers .callback-entry').each(function () {
							if (String($(this).data('number')) === number) {
								exists = true;
								return false;
							}
						});

						// prevent adding the number again if it exists
						if (exists) {
							monster.ui.alert('warning', self.i18n.active().callflows.vmbox.callback.numberExists);	
							return;
						}

						// check if number is in the deny list
						if (Array.isArray(anankeCallbacks?.denyNumbers) && anankeCallbacks.denyNumbers.includes(number)) {
							monster.ui.alert('warning', self.i18n.active().callflows.vmbox.callback.denyNumbers + anankeCallbacks.denyNumbers);
							return;
						}

						callback_html = $(self.getTemplate({
							name: 'callbackNumbers',
							data: { 
								number, 
								interval, 
								attempts 
							},
							submodule: 'vmbox'
						}));

						vmbox_html.find('.list-callback-numbers .saved-callback-numbers').append(callback_html);

						toggleCallbackListHeader();
						updateAddButtonState();

						vmbox_html.find('#callback_number, #callback_interval, #callback_attempts').val('');
						$('#tab_callback .number-wrapper.placeholder').removeClass('active');

					}
				};

				$('.number-wrapper.placeholder', vmbox_html).on('click', function (e) {
					if ($(this).hasClass('disabled')) return;
					if (!$(e.target).closest('.create-text').length) return;
					$(this).addClass('active');
					vmbox_html.find('#callback_number').focus();
					validateCallbackInputs();
				});

				$('#add_callback_number', vmbox_html).on('click', function (e) {
					e.preventDefault();
					addCallback();
				});

				$('.add-callback-number', vmbox_html).on('keypress', function (e) {
					if ((e.keyCode || e.which) === 13) {
						addCallback();
					}
				});

				vmbox_html.on('click', '.delete-callback', function () {
					$(this).closest('.callback-entry').remove();
					toggleCallbackListHeader();
					updateAddButtonState();
				});

				$('#cancel_callback_number', vmbox_html).on('click', function (e) {
					e.stopPropagation();
					$('.number-wrapper.placeholder.active', vmbox_html).removeClass('active');
					$('#callback_number, #callback_interval, #callback_attempts', vmbox_html).val('');
				});

				$('.saved-callback-numbers', vmbox_html).sortable({
					handle: '.drag-handle',
					placeholder: 'sortable-placeholder'
				});

				// function to set a limit on the number of callbacks that can be added
				function updateAddButtonState() {
					var callbackCount = vmbox_html.find('.saved-callback-numbers .callback-entry').length,
						$placeholder = vmbox_html.find('.number-wrapper.placeholder'),
						maxAllowedNumbers = anankeCallbacks.maxAllowedNumbers || 5;

					if (callbackCount >= maxAllowedNumbers) {
						$placeholder.addClass('disabled');
					} else {
						$placeholder.removeClass('disabled');
					}

				}

				updateAddButtonState();

				var $intervalInput = $('#callback_interval', vmbox_html),
					intervalMin = anankeCallbacks.callbackIntervalMin || 40,
					intervalMax = anankeCallbacks.callbackIntervalMax || 360
					intervalValue = parseInt($intervalInput.val(), 10);

				// set min/max attributes
				$intervalInput.attr('min', intervalMin).attr('max', intervalMax);

				// validation message
				if ($intervalInput.val().trim() !== '' && (isNaN(intervalValue) || intervalValue < intervalMin || intervalValue > intervalMax)) {
					$intervalInput.addClass('monster-invalid').attr('aria-invalid', 'true');
				} else {
					$('#callback_interval-error', vmbox_html).hide();
					$intervalInput.removeClass('monster-invalid').attr('aria-invalid', 'false');
				}

				// disable add button if inputs not valid
				function validateCallbackInputs() {
					var $numberInput = $('#callback_number', vmbox_html),
						$intervalInput = $('#callback_interval', vmbox_html),
						$attemptsSelect = $('#callback_attempts', vmbox_html),
						$addButton = $('#add_callback_number', vmbox_html);

					var numberVal = $numberInput.val().trim(),
						intervalVal = parseInt($intervalInput.val(), 10),
						attemptsVal = $attemptsSelect.val();

					var isNumberValid = numberVal !== '',
						isIntervalValid = !isNaN(intervalVal) && intervalVal >= intervalMin && intervalVal <= intervalMax,
						isAttemptsValid = !!attemptsVal;

					if (isNumberValid && isIntervalValid && isAttemptsValid) {
						$addButton.prop('disabled', false);
					} else {
						$addButton.prop('disabled', true);
					}
				}

				$('#callback_number', vmbox_html).on('input blur', validateCallbackInputs);
				$('#callback_interval', vmbox_html).on('input blur change', validateCallbackInputs);
				$('#callback_attempts', vmbox_html).on('change', validateCallbackInputs);

			}

			(target)
				.empty()
				.append(vmbox_html);
		},

		vmboxSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.vmboxNormalizeData($.extend(true, {}, data.data, form_data), form_data);

			if (typeof data.data === 'object' && data.data.id) {
				self.vmboxUpdate(normalized_data, function(_data, status) {
					if (typeof success === 'function') {
						success(_data, status, 'update');
					}
				}, error);
			} else {
				self.vmboxCreate(normalized_data, function(_data, status) {
					if (typeof success === 'function') {
						success(_data, status, 'create');
					}
				}, error);
			}
		},

		vmboxNormalizeData: function(mergedData, formData) {
			if (!mergedData.owner_id) {
				delete mergedData.owner_id;
			}

			if (!mergedData.media.unavailable) {
				delete mergedData.media.unavailable;
			}

			if (!mergedData.media.temporary_unavailable) {
				delete mergedData.media.temporary_unavailable;
			}

			if (mergedData.pin === '') {
				delete mergedData.pin;
			}

			if (mergedData.timezone && mergedData.timezone === 'inherit') {
				delete mergedData.timezone;
			}

			if (mergedData.media_extension === 'default') {
				delete mergedData.media_extension;
			}

			if (!mergedData.announcement_only) {
				delete mergedData.announcement_only;
			}

			mergedData.not_configurable = !mergedData.extra.allow_configuration;

			// extend doesn't override arrays...
			mergedData.notify_email_addresses = formData.notify_email_addresses;

			delete mergedData.extra;

			return mergedData;
		},

		vmboxDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			// set variables for use elsewhere
			hideAdd = args.hideAdd,
			miscSettings = args.miscSettings,
			anankeCallbacks = args.anankeCallbacks;
				
				getVoicemailNode = function(hasCategory) {
					var action = {
						name: self.i18n.active().callflows.vmbox.voicemail,
						icon: 'voicemail',
						google_icon: 'voicemail',
						module: 'voicemail',
						tip: self.i18n.active().callflows.vmbox.voicemail_tip,
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
						weight: 50,
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

							self.vmboxList(function(data) {
								var popup, popup_html;

								var selectedId = node.getMetadata('id') || '',
									selectedItem = _.find(data, { id: selectedId });

								if (!selectedItem && selectedId) {
									self.checkItemExists({
										selectedId: selectedId,
										itemList: data,
										resource: 'voicemail',
										resourceId: 'voicemailId',
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
											items: _.sortBy(data, 'name'),
											selected: node.getMetadata('id') || ''
										},
										submodule: 'vmbox'
									}));

									var selector = popup_html.find('#vmbox_selector');

									if (itemNotFound) {
										selector.attr("data-placeholder", "Configured Voicemail Not Found").addClass("item-not-found").trigger("chosen:updated");
									}

									selector.on("change", function() {
										if ($(this).val() !== null) {
											$(this).removeClass("item-not-found");
										}
									});

									// add search to dropdown
									popup_html.find('#vmbox_selector').chosen({
										width: '100%',
										disable_search_threshold: 0,
										search_contains: true
									}).on('chosen:showing_dropdown', function() {
										popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
									});

									popup_html.find('.select_wrapper').addClass('dialog_popup');

									// enable or disable the save button based on the dropdown value
									function toggleSaveButton() {
										var selectedValue = $('#vmbox_selector', popup_html).val();
										
										if (selectedValue == 'null') {
											$('#add', popup_html).prop('disabled', true);
											$('#edit_link', popup_html).hide();
										} else {
											$('#add', popup_html).prop('disabled', false);
											$('#edit_link', popup_html).show();
										}
									}

									toggleSaveButton();

									$('#vmbox_selector', popup_html).change(toggleSaveButton);

									if ($('#vmbox_selector option:selected', popup_html).val() === undefined) {
										$('#edit_link', popup_html).hide();
									}

									$('.inline_action', popup_html).click(function(ev) {
										var _data = ($(this).data('action') === 'edit') ? { id: $('#vmbox_selector', popup_html).val() } : {};

										ev.preventDefault();

										self.vmboxPopupEdit({
											data: _data,
											callback: function(vmbox) {
												node.setMetadata('id', vmbox.id || 'null');

												node.caption = vmbox.name || '';

												popup.dialog('close');
											}
										});
									});

									$('#add', popup_html).click(function() {
										node.setMetadata('id', $('#vmbox_selector', popup_html).val());

										node.caption = $('#vmbox_selector option:selected', popup_html).text();

										popup.dialog('close');
									});

									popup = monster.ui.dialog(popup_html, {
										title: self.i18n.active().callflows.vmbox.voicemail_title,
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
								resource: 'voicemail.list',
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
						editEntity: 'callflows.vmbox.edit'
					};

					if (hasCategory) {
						action.category = self.i18n.active().oldCallflows.basic_cat;
					}

					return action;
				};

			$.extend(callflow_nodes, {
				// some old nodes won't have an action set, so we need a node to support no "action"
				// this is also the node we want to use when we drag it onto a callflow as we want the back-end to use the default action set in the schemas
				'voicemail[id=*]': getVoicemailNode(true),

				// the default action being "compose", the front-end needs a node handling the "compose" action.
				// but we set the flag to false so we don't have 2 times the same node in the right list of actions
				'voicemail[id=*,action=compose]': getVoicemailNode(false),

				'voicemail[action=check]': {
					name: self.i18n.active().callflows.vmbox.check_voicemail,
					icon: 'voicemail',
					google_icon: 'voicemail',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'voicemail',
					tip: self.i18n.active().callflows.vmbox.check_voicemail_tip,
					data: {
						action: 'check'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					weight: 120,
					caption: function(node) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				}
			});
		},

		vmboxList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
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

		vmboxGet: function(vmboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.get',
				data: {
					accountId: self.accountId,
					voicemailId: vmboxId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxMessagesGet: function(vmboxId, callback) {
			var self = this;

			monster.request({
				resource: 'messages.list',
				data: {
					accountId: self.accountId,
					vmboxId: vmboxId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxCreate: function(data, callback, error) {
			var self = this;

			self.callApi({
				resource: 'voicemail.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				},
				error: function(errorPayload, data, globalHandler) {
					error && error(errorPayload);
				}
			});
		},

		vmboxUpdate: function(data, callback, error) {
			var self = this;

			self.callApi({
				resource: 'voicemail.update',
				data: {
					accountId: self.accountId,
					voicemailId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				},
				error: function(errorPayload, data, globalHandler) {
					error && error(errorPayload);
				}
			});
		},

		vmboxDelete: function(vmboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.delete',
				data: {
					accountId: self.accountId,
					voicemailId: vmboxId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		vmboxMediaList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					// sort data alphabetically
					data.data = _.sortBy(data.data, 'name');
					callback && callback(data.data);
				}
			});
		},

		vmboxUserList: function(callback) {
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

		vmboxSubmoduleButtons: function(data) {
			var existingItem = true,
				hideDelete = false;

			if (!data.id) {
				existingItem = false;
			}

			if (hideAdd.voicemail || miscSettings.vmboxPreventDelete) {
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

		}

	};

	return app;
});
