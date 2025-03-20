define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		hideAdd = false,
		miscSettings = {};

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'directoryDefineActions',
			'callflows.directory.edit': '_directoryEdit',
			'callflows.directory.submoduleButtons': 'directorySubmoduleButtons'
		},

		directoryRender: function(data, target, callbacks) {
			var self = this,
				directory_html = $(self.getTemplate({
					name: 'edit',
					data: {
						...data,
						hideAdd: hideAdd,
						miscSettings: miscSettings
					},
					submodule: 'directory'
				})),
				directoryForm = directory_html.find('#directory-form');

			self.directoryRenderUserList(data, directory_html);

			monster.ui.validate(directoryForm, {
				rules: {
					'min_dtmf': { digits: true },
					'max_dtmf': { digits: true }
				}
			});

			$('*[rel=popover]:not([type="text"])', directory_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', directory_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(directory_html);

			$('.directory-save', directory_html).click(function(ev) {
				saveButtonEvents(ev);
			});

			$('#submodule-buttons-container .save').click(function(ev) {
				saveButtonEvents(ev);
			});

			// add search to default visible dropdowns
			const chosenSelectors = [
				'#select_user_id',
				'#callflow_type',
				'#callflow_id'
			];
			
			chosenSelectors.forEach(selector => {
				directory_html.find(selector).chosen({
					width: '224px',
					disable_search_threshold: selector === '#callflow_type' ? 10 : 0, // hide search for #callflow_type
					search_contains: true
				});
			});
			
			function saveButtonEvents(ev) {

				ev.preventDefault();
				var $this = $(this);

				if (!$this.hasClass('disabled')) {
					$this.addClass('disabled');
					if (monster.ui.valid(directoryForm)) {
						var form_data = monster.ui.getFormData('directory-form');

						self.directoryCleanFormData(form_data);

						var old_list = {},
							new_list = {},
							userCallflowId;

						$('.rows .row:not(#row_no_data)', directory_html).each(function() {
							userCallflowId = $('#user_callflow_id', $(this)).val();

							if (userCallflowId !== '_empty') {
								new_list[$(this).data('id')] = userCallflowId;
							}
						});

						data.field_data.user_list = {
							old_list: data.field_data.old_list,
							new_list: new_list
						};

						self.directorySave(form_data, data, callbacks.save_success);
					} else {
						$this.removeClass('disabled');
						monster.ui.alert(self.i18n.active().callflows.directory.there_were_errors_on_the_form);
					}
				}

			};

			$('.directory-delete', directory_html).click(function(ev) {
				deleteButtonEvents(ev);
			});

			$('#submodule-buttons-container .delete').click(function(ev) {
				deleteButtonEvents(ev);
			});

			function deleteButtonEvents(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.directory.are_you_sure_you_want_to_delete, function() {
					self.directoryDelete(data.data.id, callbacks.delete_success);
				});

			};

			$('.add_user_div', directory_html).click(function() {
				var $user = $('#select_user_id', directory_html),
					$callflowType = $('#callflow_type', directory_html),
					$callflow = $('#callflow_id', directory_html),
					$userCallflow = $('#userCallflow_id', directory_html),
					$phoneOnlyCallflow = $('#phoneOnlyCallflow_id', directory_html),
					$callCentreCallflow = $('#callCentreCallflow_id', directory_html);
			
				var selectedUser = $user.val() !== "null",
					selectedCallflow = $callflow.val() !== "null",
					selectedUserCallflow = $userCallflow.val() !== "null",
					selectedPhoneOnlyCallflow = $phoneOnlyCallflow.val() !== "null",
					selectedCallCentreCallflow = $callCentreCallflow.val() !== "null";
			
				if (miscSettings.enableDirectoryCallflowFilter) {
					if (selectedUser && (selectedCallflow || selectedUserCallflow || selectedPhoneOnlyCallflow || selectedCallCentreCallflow)) {
						var selectedType = $callflowType.val(),
							callflowId;
			
						switch (selectedType) {
							case "callflow":
								callflowId = $callflow.val();
								break;
							case "userCallflow":
								callflowId = $userCallflow.val();
								break;
							case "phoneOnlyCallflow":
								callflowId = $phoneOnlyCallflow.val();
								break;
							case "callCentreCallflow":
								callflowId = $callCentreCallflow.val();
								break;
						}
			
						var user_id = $user.val(),
							user_data = {
								user_id: user_id,
								user_name: $('#option_user_' + user_id, directory_html).text(),
								callflow_id: callflowId,
								field_data: {
									callflows: data.field_data.allCallflows
								},
								_t: function(param) {
									return window.translate.directory[param];
								}
							};
			
						if ($('#row_no_data', directory_html).length > 0) {
							$('#row_no_data', directory_html).remove();
						}
			
						$('.rows', directory_html)
							.prepend($(self.getTemplate({
								name: 'userRow',
								data: {
									...user_data,
									miscSettings: miscSettings
								},
								submodule: 'directory'
							})));
			
						$('#option_user_' + user_id, directory_html).hide();
			
						// Destroy Chosen before resetting
						if ($callflow.data('chosen')) $callflow.chosen("destroy").removeAttr("data-chosen");
						if ($userCallflow.data('chosen')) $userCallflow.chosen("destroy").removeAttr("data-chosen");
						if ($phoneOnlyCallflow.data('chosen')) $phoneOnlyCallflow.chosen("destroy").removeAttr("data-chosen");
						if ($callCentreCallflow.data('chosen')) $callCentreCallflow.chosen("destroy").removeAttr("data-chosen");

						// Reset values
						$user.val('null').trigger("chosen:updated");
						$callflowType.val('null').trigger("chosen:updated");
						$callflow.val('null');
						$userCallflow.val('null');
						$phoneOnlyCallflow.val('null');
						$callCentreCallflow.val('null');

						// Reinitialize Chosen on the visible dropdown
						$('#callflow_id, #userCallflow_id, #phoneOnlyCallflow_id, #callCentreCallflow_id', directory_html)
							.filter(':visible')
							.prop('disabled', true)
							.chosen({ width: '224px', search_contains: true });

						// Disable callflow selectors initially
						$('#callflow_type', directory_html).prop('disabled', true).addClass('input-readonly').trigger("chosen:updated");
						$('.add_user_div', directory_html).prop('disabled', true);
			
					} else {
						monster.ui.alert('warning', self.i18n.active().callflows.directory.noDataSelected);
					}
				} else {
					if (selectedUser && selectedCallflow) {

						var user_id = $user.val(),
							user_data = {
								user_id: user_id,
								user_name: $('#option_user_' + user_id, directory_html).text(),
								callflow_id: $callflow.val(),
								field_data: {
									callflows: data.field_data.callflows
								},
								_t: function(param) {
									return window.translate.directory[param];
								}
							};
			
						if ($('#row_no_data', directory_html).length > 0) {
							$('#row_no_data', directory_html).remove();
						}
			
						$('.rows', directory_html)
							.prepend($(self.getTemplate({
								name: 'userRow',
								data: {
									...user_data,
									miscSettings: miscSettings
								},
								submodule: 'directory'
							})));
			
						$('#option_user_' + user_id, directory_html).hide();
			
						// Reset values after adding user
						$user.val('null').trigger("chosen:updated");
						$callflow.val('null').trigger("chosen:updated");
						
					} else {
						monster.ui.alert('warning', self.i18n.active().callflows.directory.noDataSelected);
					}
				}
			});

			$(directory_html).delegate('.action_user.delete', 'click', function() {
				var user_id = $(this).data('id');
			
				// Remove user from the grid
				$('#row_user_' + user_id, directory_html).remove();
			
				// Re-add user to the dropdown
				var $option = $('#option_user_' + user_id, directory_html);
				if ($option.length) {
					$option.show().prop('disabled', false); // Ensure it's visible and selectable
				}
			
				// Force Chosen to recognize the updated dropdown
				$('#select_user_id', directory_html).trigger("chosen:updated");
			
				// If grid is empty, add the "no data" line
				if ($('.rows .row', directory_html).length === 0) {
					$('.rows', directory_html).append($(self.getTemplate({
						name: 'userRow',
						submodule: 'directory'
					})));
				}
			});
			
			if (miscSettings.enableDirectoryCallflowFilter) {

				// Initial state
				$('#callflow_type', directory_html).prop('disabled', true).addClass('input-readonly').val('null').trigger("chosen:updated");
				$('#callflow_id', directory_html).prop('disabled', true).addClass('input-readonly').val('null').trigger("chosen:updated");
				$('.add_user_div', directory_html).prop('disabled', true);
			
				$('#userCallflow_id, #phoneOnlyCallflow_id, #callCentreCallflow_id', directory_html)
					.hide() // Hide the original <select>
					.trigger("chosen:updated"); // Update Chosen.js UI

				// hide the Chosen.js containers
				$('#userCallflow_id_chosen, #phoneOnlyCallflow_id_chosen, #callCentreCallflow_id_chosen', directory_html).hide();

				// Enable callflow type selection when user is selected
				$('#select_user_id', directory_html).on('change', function() {
					if ($(this).val() !== "null") {
						$('#callflow_type', directory_html).prop('disabled', false).removeClass('input-readonly').trigger("chosen:updated");
					} else {
						$('#callflow_type', directory_html).prop('disabled', true).addClass('input-readonly').val('null').trigger("chosen:updated");
					}
				});
			
				// Show correct callflow dropdown based on selected type
				$('#callflow_type', directory_html).on('change', function() {
					var selectedType = $(this).val();

					// Hide all callflow dropdowns and properly destroy Chosen instances
					$('#callflow_id, #userCallflow_id, #phoneOnlyCallflow_id, #callCentreCallflow_id', directory_html).each(function() {
						if ($(this).data('chosen')) {
							$(this).chosen("destroy").removeAttr("data-chosen"); // Destroy Chosen properly
						}
						$(this).hide().val('null'); // Hide dropdown and reset value
					});
				
					// Determine the correct field based on selected type
					var selectedField;
					switch (selectedType) {
						case "callflow":
							selectedField = $('#callflow_id', directory_html);
							break;
						case "userCallflow":
							selectedField = $('#userCallflow_id', directory_html);
							break;
						case "phoneOnlyCallflow":
							selectedField = $('#phoneOnlyCallflow_id', directory_html);
							break;
						case "callCentreCallflow":
							selectedField = $('#callCentreCallflow_id', directory_html);
							break;
						default:
							selectedField = null;
					}
				
					// Show only the selected field and initialize Chosen properly
					if (selectedField) {
						selectedField.show()
							.prop('disabled', false) // Ensure it's enabled
							.chosen({ width: '224px', search_contains: true });
					}

				});
				
				// Enable Add button when a callflow is selected
				$('#callflow_id, #userCallflow_id, #phoneOnlyCallflow_id, #callCentreCallflow_id', directory_html).on('change', function() {
					if ($(this).val() !== "null") {
						$('.add_user_div', directory_html).prop('disabled', false);
					} else {
						$('.add_user_div', directory_html).prop('disabled', true);
					}
				});
			
			}
			
			if (miscSettings.enableDirectoryCallflowFilter) {
				$('.rows .row:not(#row_no_data)', directory_html).each(function() {
					var userCallflowId = $('#user_callflow_id', $(this));
					if (userCallflowId.val() === '_empty') {
						userCallflowId.addClass('deleted-callflow');
					}
				});
			}	
			
			(target)
				.empty()
				.append(directory_html);
		},

		directoryRenderUserList: function(data, parent) {
			var self = this;

			if (data.data.id) {
				if ('users' in data.data && data.data.users.length > 0) {
					var user_item,
						callflowData;

					if (miscSettings.enableDirectoryCallflowFilter) {
						callflowData = data.field_data.allCallflows
					} else {
						callflowData = data.field_data.callflows
					}

					$.each(data.field_data.users, function(k, v) {
						if (v.id in data.field_data.old_list) {
							user_item = {
								user_id: v.id,
								user_name: v.first_name + ' ' + v.last_name,
								callflow_id: data.field_data.old_list[v.id],
								field_data: {
									callflows: callflowData
								}
							};

							$('.rows', parent)
								.append($(self.getTemplate({
									name: 'userRow',
									data: {
										...user_item,
										miscSettings: miscSettings
									},
									submodule: 'directory'
								})));
							$('#option_user_' + v.id, parent).hide();
						}
					});
				} else {
					$('.rows', parent)
						.empty()
						.append($(self.getTemplate({
							name: 'userRow',
							submodule: 'directory'
						})));
				}
			} else {
				$('.rows', parent)
					.empty()
					.append($(self.getTemplate({
						name: 'userRow',
						submodule: 'directory'
					})));
			}
		},

		// Added for the subscribed event to avoid refactoring directoryEdit
		_directoryEdit: function(args) {
			var self = this;
			self.directoryEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		directoryEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#directory-content'),
				target = _target || $('#directory-view', parent),
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
						min_dtmf: '3',
						max_dtmf: '0',
						sort_by: 'last_name',
						confirm_match: false
					}, data_defaults || {}),
					field_data: {
						sort_by: {
							'first_name': self.i18n.active().callflows.directory.first_name,
							'last_name': self.i18n.active().callflows.directory.last_name
						}
					}
				};

			if (miscSettings.callflowButtonsWithinHeader) {
				self.directorySubmoduleButtons(data);
			};

			monster.parallel({
							
				callflow_list: function(callback) {
					if (miscSettings.enableDirectoryCallflowFilter) {

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
							success: function(callflows) {
								var list_callflows = [];
								$.each(callflows.data, function() {
									if (this.featurecode === false) {
										list_callflows.push(this);
									}
								});

								list_callflows.sort(function(a, b) {
									var aName = (a.name || (a.numbers[0] + '')).toLowerCase(),
										bName = (b.name || (b.numbers[0] + '')).toLowerCase();

									return aName > bName ? 1 : -1;
								});

								defaults.field_data.callflows = list_callflows;

								callback(null, callflows);
							}
						});
					
					} else {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: false,
									filter_not_numbers: 'no_match'
								}
							},
							success: function(callflows) {
								var list_callflows = [];
								$.each(callflows.data, function() {
									if (this.featurecode === false) {
										list_callflows.push(this);
									}
								});

								list_callflows.sort(function(a, b) {
									var aName = (a.name || (a.numbers[0] + '')).toLowerCase(),
										bName = (b.name || (b.numbers[0] + '')).toLowerCase();

									return aName > bName ? 1 : -1;
								});

								defaults.field_data.callflows = list_callflows;

								callback(null, callflows);
							}
						});
					}
				},
				userCallflow_list: function(callback) {
					if (miscSettings.enableDirectoryCallflowFilter) {
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
							success: function(callflows) {
								var list_callflows = [];
								
								$.each(callflows.data, function() {
									if (this.name) {
										this.name = this.name.replace("SmartPBX's Callflow", '');
										list_callflows.push(this);
									}									
								});

								// Sort list_callflows alphabetically by name
								list_callflows.sort(function(a, b) {
									return a.name.localeCompare(b.name);
								});
															
								defaults.field_data.userCallflows = list_callflows;

								callback(null, callflows);
							}
						});
					} else {
						callback(null)
					}
				},
				phoneOnlyCallflow_list: function(callback) {
					if (miscSettings.enableDirectoryCallflowFilter) {
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
							success: function(callflows) {
								var list_callflows = [];
								$.each(callflows.data, function() {
									if (this.featurecode === false) {
										list_callflows.push(this);
									}
								});

								list_callflows.sort(function(a, b) {
									var aName = (a.name || (a.numbers[0] + '')).toLowerCase(),
										bName = (b.name || (b.numbers[0] + '')).toLowerCase();

									return aName > bName ? 1 : -1;
								});

								defaults.field_data.phoneOnlyCallflows = list_callflows;

								callback(null, callflows);
							}
						});
					} else {
						callback(null)
					}
				}, 
				callCentreCallflow_list: function(callback) {
					if (miscSettings.enableDirectoryCallflowFilter) {
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
							success: function(callflows) {
								var list_callflows = [];

								$.each(callflows.data, function() {
									if (this.name) {
										this.name = this.name.replace("Qubicle Callflow", '');
										list_callflows.push(this);
									}									
								});

								list_callflows.sort(function(a, b) {
									var aName = (a.name || (a.numbers[0] + '')).toLowerCase(),
										bName = (b.name || (b.numbers[0] + '')).toLowerCase();

									return aName > bName ? 1 : -1;
								});

								defaults.field_data.callCentreCallflows = list_callflows;

								callback(null, callflows);
							}
						});
					} else {
						callback(null)
					}
				},
				fullCallflow_list: function(callback) {
					if (miscSettings.enableDirectoryCallflowFilter) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: false,
									filter_not_numbers: 'no_match'
								}
							},
							success: function(callflows) {
								var list_callflows = [];
								$.each(callflows.data, function() {
									if (this.featurecode === false) {
										if (this.name) {
											if (this.name.includes("SmartPBX's Callflow")) {
												var userCallflow = this.name.replace("SmartPBX's Callflow", '');
												this.name = 'User Callflow - ' + userCallflow;
											}
											this.name = this.name.replace("Qubicle Callflow", 'Call Center Queue - ');
											list_callflows.push(this);
										}
									}
								});

								list_callflows.sort(function(a, b) {
									var aName = (a.name || (a.numbers[0] + '')).toLowerCase(),
										bName = (b.name || (b.numbers[0] + '')).toLowerCase();

									return aName > bName ? 1 : -1;
								});

								defaults.field_data.allCallflows = list_callflows;

								callback(null, callflows);
							}
						});
					} else {
						callback(null)
					}
				},
				user_list: function(callback) {
					self.callApi({
						resource: 'user.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(users) {
							users.data.sort(function(a, b) {
								var aName = (a.first_name + ' ' + a.last_name).toLowerCase(),
									bName = (b.first_name + ' ' + b.last_name).toLowerCase();

								return aName > bName ? 1 : -1;
							});

							defaults.field_data.users = users.data;

							callback(null, users);
						}
					});
				},
				directory_get: function(callback) {
					if (typeof data === 'object' && data.id) {
						self.directoryGet(data.id, function(directory, status) {
							defaults.field_data.old_list = {};

							if ('users' in directory) {
								$.each(directory.users, function(k, v) {
									defaults.field_data.old_list[v.user_id] = v.callflow_id;
								});
							}

							callback(null, directory);
						});
					} else {
						callback(null, {});
					}
				}
			}, function(err, results) {

				var render_data = defaults;

				if (typeof data === 'object' && data.id) {
					render_data = $.extend(true, defaults, { data: results.directory_get });
				}

				self.directoryRender(render_data, target, callbacks);

				if (typeof callbacks.after_render === 'function') {
					callbacks.after_render();
				}

				if (miscSettings.callflowButtonsWithinHeader) {
					miscSettings.popupEdit = false;
				}

			});
		},

		directoryPopupEdit: function(args) {
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

			self.directoryEdit(data, popup_html, $('.inline_content', popup_html), {
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
						title: (data.id) ? self.i18n.active().callflows.directory.edit_directory : self.i18n.active().callflows.directory.create_directory
					});
				}
			}, data_defaults);
		},

		directoryNormalizeData: function(form_data) {
			delete form_data.users;
			return form_data;
		},

		directoryCleanFormData: function(form_data) {
			if (!(form_data.max_dtmf > 0)) {
				delete form_data.max_dtmf;
			}

			delete form_data.callflow_type;
			delete form_data.select_user_id;
			delete form_data.user_callflow_id;
			delete form_data.user_id;
			delete form_data.callflow_id;
		},

		directorySave: function(form_data, data, success) {
			var self = this,
				normalized_data = self.directoryNormalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data === 'object' && data.data.id) {
				self.directoryUpdate(normalized_data, function(_data, status) {
					self.directoryUpdateUsers(data.field_data.user_list, _data.id, function() {
						success && success(_data, status, 'update');
					});
				});
			} else {
				self.directoryCreate(normalized_data, function(_data, status) {
					self.directoryUpdateUsers(data.field_data.user_list, _data.id, function() {
						success && success(_data, status, 'create');
					});
				});
			}
		},

		directoryUpdateSingleUser: function(user_id, directory_id, callflow_id, callback) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: user_id
				},
				success: function(_data, status) {
					if (callflow_id) {
						if (!_data.data.directories || $.isArray(_data.data.directories)) {
							_data.data.directories = {};
						}
						_data.data.directories[directory_id] = callflow_id;
					} else {
						delete _data.data.directories[directory_id];
					}

					self.callApi({
						resource: 'user.update',
						data: {
							accountId: self.accountId,
							userId: user_id,
							data: _data.data
						},
						success: callback
					});
				}
			});
		},

		directoryUpdateUsers: function(data, directory_id, success) {
			var old_directory_user_list = data.old_list,
				new_directory_user_list = data.new_list,
				self = this,
				users_updated_count = 0,
				users_count = 0,
				callback = function() {
					users_updated_count++;
					if (users_updated_count >= users_count) {
						success();
					}
				};

			if (old_directory_user_list) {
				$.each(old_directory_user_list, function(k) {
					if (!(k in new_directory_user_list)) {
						//Request to update user without this directory.
						users_count++;
						self.directoryUpdateSingleUser(k, directory_id, undefined, callback);
					}
				});

				$.each(new_directory_user_list, function(k, v) {
					if (k in old_directory_user_list) {
						if (old_directory_user_list[k] !== v) {
							//Request to update user
							users_count++;
							self.directoryUpdateSingleUser(k, directory_id, v, callback);
						}
						//else it has not been updated
					} else {
						users_count++;
						self.directoryUpdateSingleUser(k, directory_id, v, callback);
					}
				});
			} else {
				if (new_directory_user_list) {
					$.each(new_directory_user_list, function(k, v) {
						users_count++;
						self.directoryUpdateSingleUser(k, directory_id, v, callback);
					});
				}
			}

			if (users_count === 0) {
				success();
			}
		},

		directoryDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				hideCallflowAction = args.hideCallflowAction;

			// set variables for use elsewhere
			hideAdd = args.hideAdd;
			miscSettings = args.miscSettings;
			
			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			};

			var actions = {
				'directory[id=*]': {
					name: self.i18n.active().callflows.directory.directory,
					icon: 'book',
					google_icon: 'folder_shared',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'directory',
					tip: self.i18n.active().callflows.directory.directory_tip,
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
					isListed: determineIsListed('directory[id=*]'),
					weight: 160,
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

						self.directoryList(function(directories) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(directories, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: directories,
									resource: 'directory',
									resourceId: 'directoryId',
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
										items: _.sortBy(directories, 'name'),
										selected: node.getMetadata('id') || ''
									},
									submodule: 'directory'
								}));

								if ($('#directory_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#directory_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.directoryPopupEdit({
										data: _data,
										callback: function(_data) {
											node.setMetadata('id', _data.id || 'null');

											node.caption = _data.name || '';

											popup.dialog('close');
										}
									});
								});

								var selector = popup_html.find('#directory_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Directory Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#directory_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#directory_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#directory_selector', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#directory_selector', popup).val());

									node.caption = $('#directory_selector option:selected', popup).text();

									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.directory.directory_title,
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
							resource: 'directory.list',
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
					editEntity: 'callflows.directory.edit'
				}
			}

			$.extend(callflow_nodes, actions);

		},

		directoryList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'directory.list',
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

		directoryGet: function(directoryId, callback) {
			var self = this;

			self.callApi({
				resource: 'directory.get',
				data: {
					accountId: self.accountId,
					directoryId: directoryId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		directoryCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'directory.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		directoryUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'directory.update',
				data: {
					accountId: self.accountId,
					directoryId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		directoryDelete: function(directoryId, callback) {
			var self = this;

			self.callApi({
				resource: 'directory.delete',
				data: {
					accountId: self.accountId,
					directoryId: directoryId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		directorySubmoduleButtons: function(data) {
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
						hideDelete: hideAdd.directory
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
