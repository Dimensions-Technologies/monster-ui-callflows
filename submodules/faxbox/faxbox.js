define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone'),
		hideAdd = false,
		miscSettings = {};

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'faxboxDefineActions',
			'callflows.faxbox.edit': '_faxboxEdit',
			'callflows.faxbox.editPopup': 'faxboxPopupEdit',
			'callflows.faxbox.submoduleButtons': 'faxboxSubmoduleButtons'
		},

		faxboxDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				hideCallflowAction = args.hideCallflowAction;

			// set variables for use elsewhere
			hideAdd = args.hideAdd,
			miscSettings = args.miscSettings;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			};

			var actions = {
				'faxbox[id=*]': {
					name: self.i18n.active().callflows.faxbox.faxboxes_label,
					icon: 'printer2',
					google_icon: 'fax',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'faxbox',
					tip: self.i18n.active().callflows.faxbox.faxbox_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('faxbox[id=*]'),
					weight: 130,
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

						self.faxboxList(function(data, status) {
							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(data, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: data,
									resource: 'faxbox',
									resourceId: 'faxboxId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}
							
							function renderPopup(itemNotFound) {
								var popup_html = $(self.getTemplate({
										name: 'callflowEdit',
										data: {
											items: _.sortBy(data, 'name'),
											selected: node.getMetadata('id') || ''
										},
										submodule: 'faxbox'
									})),
									popup;

								if ($('#faxbox_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#faxbox_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.faxboxPopupEdit({
										data: _data,
										callback: function(_data) {
											node.setMetadata('id', _data.id || 'null');

											node.caption = _data.name || '';

											popup.dialog('close');
										}
									});
								});

								var selector = popup_html.find('#faxbox_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Faxbox Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#faxbox_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#faxbox_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#faxbox_selector', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#faxbox_selector', popup_html).val());

									node.caption = $('#faxbox_selector option:selected', popup_html).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.faxbox.faxboxes_label,
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
							resource: 'faxbox.list',
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
					editEntity: 'callflows.faxbox.edit'
				}
			}

			$.extend(callflow_nodes, actions);

		},

		faxboxPopupEdit: function(args) {
			var self = this,
				popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>'),
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults || {},
				popup;

			if (miscSettings.callflowButtonsWithinHeader) {
				miscSettings.popupEdit = true;
			}
			
			self.faxboxEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: self.i18n.active().callflows.faxbox[(data.id ? 'edit' : 'create').concat('_faxbox')]
					});
				}
			}, data_defaults);
		},

		// Added for the subscribed event to avoid refactoring faxboxEdit
		_faxboxEdit: function(args) {
			var self = this;
			self.faxboxEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		faxboxEdit: function(data, _parent, _target, _callbacks) {
			var self = this,
				parent = _parent || $('#faxbox-content'),
				target = _target || $('#faxbox-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success || function(_data) {
						self.faxboxRenderList(parent);

						self.faxboxEdit({ id: _data.id }, parent, target, callbacks);
					},
					delete_success: _callbacks.delete_success || function() {
						target.empty();

						self.faxboxRenderList(parent);
					},
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				};

			monster.parallel({
				faxbox: function(callback) {
					if (typeof data === 'object' && data.id) {
						self.faxboxGet(data.id, function(_data, status) {
							_data.id = data.id;

							callback(null, _data);
						});
					} else {
						callback(null, {});
					}
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
								if (a.hasOwnProperty('first_name') && a.hasOwnProperty('last_name') && b.hasOwnProperty('first_name') && b.hasOwnProperty('last_name')) {
									return a.first_name.concat(' ', a.last_name).toLowerCase() > b.first_name.concat(' ', b.last_name).toLowerCase() ? 1 : -1;
								} else {
									return 1;
								}
							});

							_data.data.unshift({
								id: '',
								first_name: self.i18n.active().callflowsApp.common.noOwner,
								last_name: ''
							});

							callback(null, _data.data);
						}
					});
				},
				current_user: function(callback) {
					if (!monster.util.isMasquerading()) {
						self.faxboxGetUser(self.userId, function(_data, status) {
							callback(null, _data);
						});
					} else {
						callback(null, {});
					}
				},
				phone_numbers: function(callback) {
					self.callApi({
						resource: 'numbers.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
						},
						success: function(_data) {
							var numbers = _.get(_data, 'data.numbers', {}),
								allNumbers = _.keys(numbers).sort(),
								spareNumbers = _.chain(numbers)
									.pickBy(function(meta) {
										return !meta.hasOwnProperty('used_by') || meta.used_by === '';
									})
									.keys()
									.sortBy()
									.value();

							callback(null, {
								all: allNumbers,
								spare: spareNumbers
							});
						}
					});
				}
			}, function(err, results) {

				miscSettings.readOnlyFaxbox = false;

				if (results.faxbox.hasOwnProperty('owner_id') && results.faxbox.owner_id != null) {
					if (miscSettings.faxboxPreventDeletingUserAssociated) {
						miscSettings.readOnlyFaxbox = true;
					}
				}

				if (miscSettings.readOnlyFaxbox || miscSettings.readOnlyFaxboxCallerId) {
					miscSettings.readOnlyFaxboxCallerId = true;
				}

				if (!data.hasOwnProperty('id')) {
					results.faxbox = $.extend(true, self.faxboxGetDefaultSettings(), results.faxbox);
				}

				delete results.current_user;

				results.spare_phone_numbers = results.phone_numbers.spare;
				results.phone_numbers = results.phone_numbers.all;

				var invalidCallerID = _.find(results.phone_numbers, _.get(results.faxbox, 'caller_id', null));

				if (!invalidCallerID) {
					results.phone_numbers.unshift(results.faxbox.caller_id);
				}

				if (miscSettings.callflowButtonsWithinHeader && !miscSettings.popupEdit) {
					self.faxboxSubmoduleButtons(data);
				};

				self.faxboxGetCallflow(results.faxbox, function(faxboxCallflow) {
					var faxboxCallflowNumber = _.get(faxboxCallflow, 'numbers[0]');

					if (faxboxCallflowNumber && !_.includes(results.phone_numbers, faxboxCallflowNumber)) {
						results.phone_numbers.unshift(faxboxCallflowNumber);
					}

					if (faxboxCallflowNumber && !_.includes(results.spare_phone_numbers, faxboxCallflowNumber)) {
						results.spare_phone_numbers.unshift(faxboxCallflowNumber);
					}

					results.faxbox_callflow = faxboxCallflow;

					self.faxboxRender(results, target, callbacks);

					if (typeof callbacks.after_render === 'function') {
						callbacks.after_render();
					}

					if (miscSettings.callflowButtonsWithinHeader) {
						miscSettings.popupEdit = false;
					}
				});

			});
		},

		faxboxRender: function(data, target, callbacks) {
			var self = this,
				renderData = data,
				normalizedFaxbox = self.faxboxNormalizedData(data.faxbox),
				selectedFaxboxNumber = _.get(data, 'selected_faxbox_number', '') || _.get(data, 'faxbox_callflow.numbers[0]', ''),
				faxbox_html = $(self.getTemplate({
					name: 'edit',
					data: {
						hideAdd: hideAdd,
						miscSettings: miscSettings,
						faxbox: $.extend(true, {}, normalizedFaxbox, {
							realm: monster.apps.auth.currentAccount.realm,
							number: selectedFaxboxNumber
						}),
						users: data.user_list,
						phone_numbers: data.phone_numbers,
						spare_phone_numbers: data.spare_phone_numbers,
						faxbox_callflow_number: selectedFaxboxNumber,
						inbound_email_notification: null
					},
					submodule: 'faxbox'
				}));

			timezone.populateDropdown($('#fax_timezone', faxbox_html), data.faxbox.fax_timezone || 'inherit', {
				inherit: self.i18n.active().defaultTimezone
			});

			$('*[rel=popover]:not([type="text"])', faxbox_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', faxbox_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(faxbox_html);

			function persistFaxboxNumber(number) {
				renderData.selected_faxbox_number = number || '';
			}

			faxbox_html.find('#faxbox_number').on('change', function() {
				persistFaxboxNumber($(this).val() || '');
			});

			// section commented out since we are not supporting assigning a faxbox to a user from the faxbox section
			/*
			var ownerChangeRequestId = 0;

			if (!miscSettings.hideFaxboxUserAssignment) {
				if (!data.faxbox.hasOwnProperty('id')) {
					$('#owner_id', faxbox_html).change(function(ev) {
						var currentFaxbox = monster.ui.getFormData('faxbox_form'),
							preservedFaxboxNumber = $('#faxbox_number', faxbox_html).val() || currentFaxbox.faxbox_number || _.get(renderData, 'selected_faxbox_number', '') || _.get(renderData, 'faxbox_callflow.numbers[0]', ''),
							preservedCallerId = $('#caller_id', faxbox_html).val() || currentFaxbox.caller_id || _.get(data, 'faxbox.caller_id', ''),
							preservedCallerName = $('#caller_name', faxbox_html).val() || currentFaxbox.caller_name || _.get(data, 'faxbox.caller_name', ''),
							preservedFaxIdentity = $('#fax_identity', faxbox_html).val() || currentFaxbox.fax_identity || _.get(data, 'faxbox.fax_identity', ''),
							requestId = ++ownerChangeRequestId;

						persistFaxboxNumber(preservedFaxboxNumber);

						if ($(this).val()) {
							self.faxboxGetUser($(this).val(), function(_data, status) {
								if (requestId !== ownerChangeRequestId) {
									return;
								}

								data.faxbox = $.extend(true, {}, self.faxboxGetDefaultSettings(_data), {
									caller_id: preservedCallerId,
									caller_name: preservedCallerName,
									fax_identity: preservedFaxIdentity
								});
								$('#edit_link', faxbox_html).show();
								self.faxboxRender(data, target, callbacks);
							});
						} else {
							data.faxbox = $.extend(true, {}, self.faxboxGetDefaultSettings(), {
								caller_id: preservedCallerId,
								caller_name: preservedCallerName,
								fax_identity: preservedFaxIdentity
							});
							$('#edit_link', faxbox_html).hide();
							self.faxboxRender(data, target, callbacks);
						}
					});
				} else {
					$('#owner_id', faxbox_html).change(function(ev) {
						var currentFaxbox = monster.ui.getFormData('faxbox_form'),
							preservedCallerId = $('#caller_id', faxbox_html).val() || currentFaxbox.caller_id || _.get(data, 'faxbox.caller_id', ''),
							preservedCallerName = $('#caller_name', faxbox_html).val() || currentFaxbox.caller_name || _.get(data, 'faxbox.caller_name', ''),
							preservedFaxIdentity = $('#fax_identity', faxbox_html).val() || currentFaxbox.fax_identity || _.get(data, 'faxbox.fax_identity', ''),
							requestId = ++ownerChangeRequestId;

						if ($(this).val()) {
							$('[id$="bound_notification_email"]', faxbox_html).each(function(idx, el) {
								$(el).attr('disabled', true);
							});

							self.faxboxGetUser($(this).val(), function(_data, status) {
								if (requestId !== ownerChangeRequestId) {
									return;
								}

								data.faxbox = $.extend(true, {}, self.faxboxGetDefaultSettings(), data.faxbox, currentFaxbox, {
									cloud_connector_claim_url: faxbox_html.find('#cloud_connector_claim_url').attr('href'),
									notifications: {
										inbound: {
											email: {
												send_to: _data.email || _data.username
											}
										},
										outbound: {
											email: {
												send_to: _data.email || _data.username
											}
										}
									}
								});
									data.faxbox.caller_id = preservedCallerId;
									data.faxbox.caller_name = preservedCallerName;
									data.faxbox.fax_identity = preservedFaxIdentity;
									persistFaxboxNumber($('#faxbox_number', faxbox_html).val() || currentFaxbox.faxbox_number || _.get(renderData, 'selected_faxbox_number', '') || _.get(renderData, 'faxbox_callflow.numbers[0]', ''));

								$('#edit_link', faxbox_html).hide();
								self.faxboxRender(data, target, callbacks);
							});
						} else {
							$('[id$="bound_notification_email"]', faxbox_html).each(function(idx, el) {
								$(el).attr('disabled', false);
							});
						}
					});
				}
			}
			*/

			if (!$('#owner_id', faxbox_html).val()) {
				$('#edit_link', faxbox_html).hide();
			}

			$('.inline-action', faxbox_html).click(function(ev) {
				var _data = $(this).data('action') === 'edit' ? { id: $('#owner_id', faxbox_html).val() } : {},
					_id = _data.id;

				monster.pub('callflows.user.popupEdit', {
					data: _data,
					callflow: function(_data) {
						/* Create */
						if (!_id) {
							$('#owner_id', faxbox_html).append('<option id="' + _data.id + '" value="' + _data.id + '">' + _data.first_name + ' ' + _data.last_name + '</option>');
							$('#owner_id', faxbox_html).val(_data.id);
						} else {
							/* Update */
							if ('id' in _data) {
								$('#owner_id #' + _data.id, faxbox_html).text(_data.first_name + ' ' + _data.last_name);
							/* Delete */
							} else {
								$('#owner_id #' + _id, faxbox_html).remove();
							}
						}
					}
				});
			});

			$('#caller_id', faxbox_html).change(function(ev) {
				var number = $(this).val(),
					fax_identity = $('#fax_identity', faxbox_html);

				if (/^(\+1|1)([0-9]{10})$|^([0-9]{10})$/.test(number)) {
					if (/^(\+1)/.test(number)) {
						fax_identity.val(number.replace(/^\+1([0-9]{3})([0-9]{3})([0-9]{4})$/, '+1 ($1) $2-$3'));
					} else if (/^1([0-9]{10})$/.test(number)) {
						fax_identity.val(number.replace(/^1([0-9]{3})([0-9]{3})([0-9]{4})$/, '+1 ($1) $2-$3'));
					} else {
						fax_identity.val(number.replace(/^([0-9]{3})([0-9]{3})([0-9]{4})$/, '+1 ($1) $2-$3'));
					}
				} else {
					fax_identity.val('');
				}
			});

			$('.faxbox-save', faxbox_html).click(function(ev) {
				saveButtonEvents(ev);
			});

			if (miscSettings.callflowButtonsWithinHeader && !miscSettings.popupEdit) {
				$('#submodule-buttons-container .save')
					.off('click.faxbox')
					.on('click.faxbox', function(ev) {
						saveButtonEvents(ev);
					});
			}

			// add search to dropdown
			monster.ui.chosen(faxbox_html.find('.callflows-caller-id-dropdown'));
			monster.ui.chosen(faxbox_html.find('select#faxbox_number'));
			monster.ui.chosen(faxbox_html.find('select#owner_id'));
			monster.ui.chosen(faxbox_html.find('#fax_timezone'));

			if (miscSettings.readOnlyFaxboxCallerId) {
				faxbox_html.find('#faxbox_number').on('change', function() {
					var selectedNumber = $(this).val() || '',
						formattedNumber = selectedNumber ? monster.util.formatPhoneNumber(selectedNumber) : '';

					faxbox_html.find('#caller_id_display').val(formattedNumber);
					faxbox_html.find('#caller_id').val(selectedNumber);
					faxbox_html.find('#fax_identity').val(formattedNumber);

					if (miscSettings.readOnlyCallerIdName) {
						faxbox_html.find('#caller_name').val(formattedNumber);
					}
				});
			}
			
			function saveButtonEvents(ev) {
				ev.preventDefault();

				var form_html = $('#faxbox_form', faxbox_html),
					form_data = monster.ui.getFormData('faxbox_form'),
					faxboxNumber = form_data.faxbox_number || $('#faxbox_number', faxbox_html).val() || _.get(renderData, 'selected_faxbox_number', '') || '',
					word_reg = /^[\w\s'-]+/;

				// prevent save if this is a non user associated faxbox and not all required fields are set
				if (!form_data.hasOwnProperty('owner_id')) {
					var faxboxNumber = form_data.faxbox_number,
						inboundEmail = form_data.notifications.inbound.email.send_to,
						permissionList = form_data.smtp_permission_list;

					if (faxboxNumber == '' || inboundEmail == '' || permissionList == '') {
						monster.ui.alert('warning', self.i18n.active().callflows.faxbox.can_not_save);
						return
					}
				}

				monster.ui.validate(form_html, {
					rules: {
						name: {
							required: true
						},
						'caller_name': {
							regex: word_reg
						},
						'fax_header': {
							regex: word_reg
						},
						retries: {
							regex: /^[0-4]/
						}
					},
					messages: {
						'caller_name': {
							regex: self.i18n.active().callflows.faxbox.validation.words
						},
						'fax_header': {
							regex: self.i18n.active().callflows.faxbox.validation.words
						},
						retries: {
							regex: 'Please enter a numeric value between 0 and 4'
						}
					}
				});

				var $this = $(this);

				if (!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if (monster.ui.valid(form_html)) {
						persistFaxboxNumber(faxboxNumber);
						delete renderData.faxbox.custom_smtp_address;
						delete form_data.faxbox_number;
						self.faxboxSave(form_data, renderData.faxbox, function(savedFaxbox) {
							self.faxboxSyncCallflowNumber({
								faxbox: savedFaxbox,
								currentCallflow: renderData.faxbox_callflow,
								number: faxboxNumber,
								ownerId: savedFaxbox.owner_id || savedFaxbox.id || form_data.owner_id || renderData.faxbox.owner_id || renderData.faxbox.id
							}, function(updatedCallflow) {
								renderData.faxbox = savedFaxbox;
								renderData.faxbox_callflow = updatedCallflow;
								renderData.selected_faxbox_number = faxboxNumber;
								$this.removeClass('disabled');
								callbacks && callbacks.hasOwnProperty('save_success') && callbacks.save_success(savedFaxbox);
							}, function() {
								renderData.faxbox = savedFaxbox;
								renderData.selected_faxbox_number = faxboxNumber;
								$this.removeClass('disabled');
								callbacks && callbacks.hasOwnProperty('save_success') && callbacks.save_success(savedFaxbox);
							});
						}, function(data) {
							$this.removeClass('disabled');
						});
					} else {
						$this.removeClass('disabled');
					}
				}
			};

			$('.faxbox-delete', faxbox_html).click(function(ev) {
				deleteButtonEvents(ev);
			});

			if (miscSettings.callflowButtonsWithinHeader && !miscSettings.popupEdit) {
				$('#submodule-buttons-container .delete')
					.off('click.faxbox')
					.on('click.faxbox', function(ev) {
						deleteButtonEvents(ev);
					});
			}

			function deleteButtonEvents(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.faxbox.are_you_sure_you_want_to_delete, function() {
					self.faxboxDelete(data.faxbox, callbacks.delete_success, callbacks.delete_error);
				});

			};

			target
				.empty()
				.append(faxbox_html);
		},

		faxboxRenderList: function(parent) {
			var self = this;

			self.faxboxList(function(data, status) {
				var map_crossbar_data = function(data) {
					var new_list = [];

					if (data.length > 0) {
						$.each(data, function(key, val) {
							new_list.push({
								id: val.id,
								title: val.name || self.i18n.active().callflows.faxbox.no_name
							});
						});
					}

					new_list.sort(function(a, b) {
						return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
					});

					return new_list;
				};
			});
		},

		faxboxGetCallflow: function(faxbox, callback) {
			var self = this,
				callflowOwnerId = _.get(faxbox, 'owner_id') || _.get(faxbox, 'id');
			
			if (!faxbox || !faxbox.id || !callflowOwnerId) {
				callback && callback(null);

				return;
			}

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false,
						filter_owner_id: callflowOwnerId,
						filter_type: 'faxing'
					}
				},
				success: function(data) {
					var callflowId = _.get(data, 'data[0].id');

					if (!callflowId) {
						callback && callback(null);

						return;
					}

					self.callApi({
						resource: 'callflow.get',
						data: {
							accountId: self.accountId,
							callflowId: callflowId
						},
						success: function(callflowData) {
							var callflow = callflowData.data;

							if (_.get(callflow, 'flow.data.id') !== faxbox.id) {
								callback && callback(null);

								return;
							}

							callback && callback(callflow);
						},
						error: function() {
							callback && callback(null);
						}
					});
				},
				error: function() {
					callback && callback(null);
				}
			});
		},

		faxboxSyncCallflowNumber: function(args, success, error) {
			var self = this,
				faxbox = args.faxbox,
				number = args.number,
				ownerId = args.ownerId || _.get(faxbox, 'owner_id') || _.get(faxbox, 'id'),
				currentCallflow = args.currentCallflow,
				currentNumber = _.get(currentCallflow, 'numbers[0]', '');

			if (!faxbox || !faxbox.id || !number) {
				success && success(currentCallflow || null);
				return;
			}

			if (currentCallflow && currentCallflow.id && currentNumber === number) {
				success && success(currentCallflow);
				return;
			}

			if (currentCallflow && currentCallflow.id) {
				self.callApi({
					resource: 'callflow.patch',
					data: {
						accountId: self.accountId,
						callflowId: currentCallflow.id,
						data: {
							numbers: [number],
							ui_metadata: {
								origin: 'voip'
							}
						},
						removeMetadataAPI: true
					},
					success: function(callflowData) {
						success && success(callflowData.data);
					},
					error: function() {
						error && error();
					}
				});

				return;
			}

			self.callApi({
				resource: 'callflow.create',
				data: {
					accountId: self.accountId,
					data: {
						type: 'faxing',
						owner_id: ownerId,
						numbers: [number],
						flow: {
							module: 'faxbox',
							children: {},
							data: {
								id: faxbox.id
							}
						},
						ui_metadata: {
							origin: 'voip'
						}
					},
					removeMetadataAPI: true
				},
				success: function(callflowData) {
					success && success(callflowData.data);
				},
				error: function() {
					error && error();
				}
			});
		},

		faxboxGetDefaultSettings: function(user) {
			var self = this,
				default_faxbox = {
					name: '',
					caller_name: '',
					fax_header: 'Fax Printer',
					fax_timezone: 'inherit',
					retries: 3,
					notifications: {
						inbound: {
							email: {
								send_to: ''
							}
						},
						outbound: {
							email: {
								send_to: ''
							}
						}
					}
				};

			if (typeof user === 'undefined') {
				return default_faxbox;
			} else {
				return $.extend(true, {}, default_faxbox, {
					name: user.first_name.concat(' ', user.last_name, self.i18n.active().callflows.faxbox.default_settings_name_extension),
					caller_name: user.first_name.concat(' ', user.last_name),
					fax_header: 'Fax Printer',
					owner_id: user.id,
					notifications: {
						inbound: {
							email: {
								send_to: user.email || user.username
							}
						},
						outbound: {
							email: {
								send_to: user.email || user.username
							}
						}
					}
				});
			}
		},

		faxboxSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.faxboxNormalizedData($.extend(true, {}, data, form_data));

			if (typeof data === 'object' && data.id) {
				self.faxboxUpdate(normalized_data, function(_data, status) {
					if (typeof success === 'function') {
						success(_data, status, 'update');
					}
				}, function(_data, status) {
					if (typeof error === 'function') {
						error(_data, status, 'update');
					}
				});
			} else {
				self.faxboxCreate(normalized_data, function(_data, status) {
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

		faxboxNormalizedData: function(form_data) {
			if (form_data.hasOwnProperty('notifications')) {
				if (form_data.notifications.hasOwnProperty('inbound') && form_data.notifications.inbound.hasOwnProperty('email') && form_data.notifications.inbound.email.hasOwnProperty('send_to')) {
					if (form_data.notifications.inbound.email.send_to.length) {
						var inbound = form_data.notifications.inbound.email.send_to;
						form_data.notifications.inbound.email.send_to = inbound instanceof Array ? inbound.join(',') : inbound.replace(/\s/g, '').split(',');
					} else {
						delete form_data.notifications.inbound.email.send_to;
					}
				}

				if (form_data.notifications.hasOwnProperty('outbound') && form_data.notifications.outbound.hasOwnProperty('email') && form_data.notifications.outbound.email.hasOwnProperty('send_to')) {
					if (form_data.notifications.outbound.email.send_to.length) {
						var outbound = form_data.notifications.outbound.email.send_to;
						form_data.notifications.outbound.email.send_to = outbound instanceof Array ? outbound.join(',') : outbound.replace(/\s/g, '').split(',');
					} else {
						delete form_data.notifications.outbound.email.send_to;
					}
				}
			}

			if (form_data.hasOwnProperty('smtp_permission_list')) {
				if (form_data.smtp_permission_list === '') {
					delete form_data.smtp_permission_list;
				} else {
					var list = form_data.smtp_permission_list;

					form_data.smtp_permission_list = list instanceof Array ? list.join(',') : list.replace(/\s/g, '').split(',');
				}
			}

			if (form_data.hasOwnProperty('custom_smtp_email_address') && form_data.custom_smtp_email_address === '') {
				delete form_data.custom_smtp_email_address;
			}

			if (form_data.hasOwnProperty('owner_id') && form_data.owner_id === '') {
				delete form_data.owner_id;
			}

			if (form_data.fax_timezone && form_data.fax_timezone === 'inherit') {
				delete form_data.fax_timezone;
			}

			if (form_data.caller_id === '_disabled') {
				delete form_data.caller_id;
			}

			return form_data;
		},

		faxboxList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.list',
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

		faxboxGet: function(faxboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'faxbox.get',
				data: {
					accountId: self.accountId,
					faxboxId: faxboxId
				},
				success: function(data) {
					var custom_smtp_address = _.get(data, 'metadata.custom_smtp_address');

					if (custom_smtp_address) {
						data.data.custom_smtp_address = custom_smtp_address;
					}

					callback && callback(data.data);
				}
			});
		},

		faxboxCreate: function(data, callback, error) {
			var self = this;

			self.callApi({
				resource: 'faxbox.create',
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

		faxboxUpdate: function(data, callback, error) {
			var self = this;

			self.callApi({
				resource: 'faxbox.update',
				data: {
					accountId: self.accountId,
					faxboxId: data.id,
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

		faxboxDelete: function(data, callbackSuccess, callbackError) {
			var self = this;

			if (typeof data === 'object' && data.hasOwnProperty('id')) {
				self.faxboxGetCallflow(data, function(callflow) {
					self.callApi({
						resource: 'faxbox.delete',
						data: {
							accountId: self.accountId,
							faxboxId: data.id
						},
						success: function(faxboxData) {
							if (!callflow || !callflow.id) {
								callbackSuccess && callbackSuccess(faxboxData.data);

								return;
							}

							self.callApi({
								resource: 'callflow.delete',
								data: {
									accountId: self.accountId,
									callflowId: callflow.id
								},
								success: function() {
									callbackSuccess && callbackSuccess(faxboxData.data);
								},
								error: function() {
									callbackSuccess && callbackSuccess(faxboxData.data);
								}
							});
						},
						error: function() {
							callbackError && callbackError();
						}
					});
				});
			}
		},

		faxboxGetUser: function(userId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(data, status) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data, status) {
					callbackError && callbackError();
				}
			});
		},

		faxboxSubmoduleButtons: function(data) {
			var existingItem = true,
				hideDelete = false;
			
			if (!data.id) {
				existingItem = false;
			}

			if (miscSettings.readOnlyFaxbox) {
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
