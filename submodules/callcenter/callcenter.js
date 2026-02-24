define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		toastr = require('toastr'),
		monster = require('monster'),
		miscSettings = {};

	var app = {
		requests: {
			'callcenter.queues.list': {
				'verb': 'GET',
				'url': 'accounts/{accountId}/queues'
			},
			'callcenter.queues.create': {
				'verb': 'PUT',
				'url': 'accounts/{accountId}/queues'
			},
			'callcenter.queues.get': {
				'verb': 'GET',
				'url': 'accounts/{accountId}/queues/{queuesId}'
			},
			'callcenter.queues.update': {
				'verb': 'POST',
				'url': 'accounts/{accountId}/queues/{queuesId}'
			},
			'callcenter.queues.patch': {
				'verb': 'PATCH',
				'url': 'accounts/{accountId}/queues/{queuesId}'
			},
			'callcenter.queues.delete': {
				'verb': 'DELETE',
				'url': 'accounts/{accountId}/queues/{queuesId}'
			},
			'callcenter.agents.update': {
				'verb': 'POST',
				'url': 'accounts/{accountId}/queues/{queuesId}/roster'
			},
			'callcenter.agents.state': {
				'verb': 'GET',
				'url': 'accounts/{accountId}/queues/{queuesId}/agents/status',
				'generateError': false
			}
		},

		validationRules: {
			'#name': {
				regex: /^.*/
			},
			'#connection_timeout': {
				regex: /^[0-9]+$/
			},
			'#member_timeout': {
				regex: /^[0-9]+$/
			}/*,
			 '#caller_exit_key': {
			 regex: /^.{1}/
			 }*/
		},

		subscribe: {
			'callflows.fetchActions': 'callcenterDefineActions',
			'callflows.queue.editPopup': 'queuePopupEdit',
			'callflows.queue.edit': 'queueEdit',
			'callflows.queue.submoduleButtons': 'queueSubmoduleButtons'

		},

		random_id: false,

		callcenterDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				//i18nApp = self.i18n.active().callflows.callcenter,
				hideCallflowAction = args.hideCallflowAction;

			// set variables for use elsewhere
			miscSettings = args.miscSettings;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			}

			$.extend(callflow_nodes, {
				'acdc_member[id=*]': {
					name: self.i18n.active().callflows.acdc.callflowActions.queue,
					icon: 'support',
                    google_icon: 'support_agent',
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'acdc_member',
					tip: self.i18n.active().callflows.acdc.callflowActions.queueTip,
					data: {
						id: 'null'
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
					isListed: determineIsListed('acdc_member[id=*]'),
					weight: 82,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						self.getQueuesList(function(queues) {
							var popup, popup_html;

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(queues, { id: selectedId });	

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: queues,
									resource: 'callcenter.queues',
									resourceId: 'queuesId',
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
										i18n: self.i18n.active(),
										objects: {
											items: queues,
											selected: node.getMetadata('id') || '',
											priority: node.getMetadata('priority') || '',
										}
									},
									submodule: 'callcenter'
								}));

								if ($('#queue_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									ev.preventDefault();

									var _data = {};
									if ($(this).data('action') === 'edit') {
										_data = {
											id: $('#queue_selector', popup_html).val(),
											priority: $('#queue_priority', popup_html).val()
										}
									}

									self.queuePopupEdit({
										data: _data,
										callback: function(_data) {
											node.setMetadata('id', _data.id || 'null');
											_data.priority && node.setMetadata('priority', _data.priority);
											node.caption = _data.name || '';

											popup.dialog('close');
										}
									});
								});

								var selector = popup_html.find('#queue_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Queue Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#queue_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#queue_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
									} else {
										$('#add', popup_html).prop('disabled', false);
									}
								}

								toggleSaveButton();

								$('#queue_selector', popup_html).change(toggleSaveButton);

								$('#add', popup_html).click(function() {
									node.setMetadata('id', $('#queue_selector', popup).val());
									node.setMetadata('priority', parseInt($('#queue_priority', popup).val()));
									node.caption = $('#queue_selector option:selected', popup).text();
									popup.dialog('close');
								});

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.acdc.callflowActions.queueTitle,
									minHeight: '0',
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});

								monster.ui.tooltips(popup);
							}
						});
					},
					listEntities: function(callback) {
						monster.request({
							resource: 'callcenter.queues.list',
							data: {
								accountId: self.accountId
							},
							success: function(queueResp) {

								var queues = queueResp.data || [];

								// list queue callflows
								self.listQueueCallflows(function(callflows) {

									// map based on callflow owner_id
									var callflowMap = {};

									_.each(callflows, function(cf) {
										if (cf.owner_id) {
											callflowMap[cf.owner_id] = cf;
										}
									});

									// add numbers to list data
									_.each(queues, function(queue) {

										var cf = callflowMap[queue.id];

										if (cf) {
											queue.callflow_id = cf.id;
											queue.numbers = cf.numbers || [];
											queue.callflow_name = cf.name || null;
										} else {
											queue.callflow_id = null;
											queue.numbers = [];
											queue.callflow_name = null;
										}
									});

									// sort the data based on the 'name' field
									queues.sort(function(a, b) {
										return a.name.localeCompare(b.name);
									});

									callback && callback(queues);
								});
							}
						});
					},
					editEntity: 'callflows.queue.edit'
				},
				'acdc_agent[action=resume]': {
					name: self.i18n.active().callflows.acdc.callflowActions.agentResume,
					icon: 'check_circle',
                    google_icon: 'play_circle',
					category: self.i18n.active().oldCallflows.acdc_cat,
					module: 'acdc_agent',
					tip: '',
					data: {
						action: 'resume',
						retries: '3'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('acdc_agent[action=resume]'),
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'acdc_agent[action=paused]': {
					name: self.i18n.active().callflows.acdc.callflowActions.agentPause,
					icon: 'minus_circle',
                    google_icon: 'pause_circle',
					category: self.i18n.active().oldCallflows.acdc_cat,
					module: 'acdc_agent',
					tip: '',
					data: {
						action: 'paused',
						retries: '3'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('acdc_agent[action=paused]'),
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'acdc_agent[action=logout]': {
					name: self.i18n.active().callflows.acdc.callflowActions.agentLogout,
					icon: 'hotdesk_logout',
                    google_icon: 'logout',
					category: self.i18n.active().oldCallflows.acdc_cat,
					module: 'acdc_agent',
					tip: '',
					data: {
						action: 'logout',
						retries: '3'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('acdc_agent[action=logout]'),
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'acdc_agent[action=login]': {
					name: self.i18n.active().callflows.acdc.callflowActions.agentLogin,
					icon: 'hotdesk_login',
                    google_icon: 'login',
					category: self.i18n.active().oldCallflows.acdc_cat,
					module: 'acdc_agent',
					tip: '',
					data: {
						action: 'login',
						retries: '3'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('acdc_agent[action=login]'),
					caption: function(node, caption_map) {
						return '';
					},
					edit: function(node, callback) {
						if (typeof callback === 'function') {
							callback();
						}
					}
				},
				'acdc_agent[action=toggle]': {
					name: self.i18n.active().callflows.acdc.callflowActions.agentToggle,
					icon: 'hotdesk_toggle',
                    google_icon: 'restart_alt',
					category: self.i18n.active().oldCallflows.acdc_cat,
					module: 'acdc_agent',
					tip: '',
					data: {
						action: 'toggle',
						retries: '3'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '0'
						}
					],
					isTerminating: 'true',
					isUsable: 'true',
					isListed: determineIsListed('acdc_agent[action=toggle]'),
					caption: function(node, caption_map) {
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

		queuePopupEdit: function(args) {
			var self = this,
				popup_html = $('<div class="callflows-callcenter-popup inline_popup callflows-port"><div class="inline_content main_content"></div></div>'),
				callback = args.callback,
				popup,
				data = args.data,
				data_defaults = args.data_defaults;

			popup_html.css({
				height: 500,
				'overflow-y': 'scroll'
			});

			self.queueEdit({
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
							title: (data.id) ? self.i18n.active().callflows.callcenter.editQueue : self.i18n.active().callflows.callcenter.createQueue
						});
					}
				},
				data_defaults: data_defaults
			});
		},

		queueEdit: function(args) {

			var self = this,
				data = args.data,
				parent = args.parent || $('#queue-content'),
				target = args.target || $('#queue-view', parent),
				_callbacks = args.callbacks || {},
				queueId = data.id,
				callbacks = {
					save_success: _callbacks.save_success || function (_data) {
						self.queueRenderList(parent);
						self.queueEdit({
							data: {
								id: _data.data.id
							},
							parent: parent,
							target: target,
							callbacks: callbacks
						});
					},
					save_error: _callbacks.save_error,
					delete_success: _callbacks.delete_success || function () {
						target.empty();

						self.queueRenderList(parent);
					},
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				},
				defaults = {
					data: {},
					field_data: {
						sort_by: {
							'first_name': self.i18n.active().callflows.callcenter.first_name,
							'last_name': self.i18n.active().callflows.callcenter.last_name
						}
					}
				}

			if (miscSettings.callflowButtonsWithinHeader) {
				self.queueSubmoduleButtons(data);
			};

			var parallelTasks = {

				media_list: function (callback) {

					var mediaFilters = {
						paginate: false
					};
		
					if (miscSettings.hideMailboxMedia) {
						mediaFilters['filter_not_media_source'] = 'recording';
					}

					if (!miscSettings.mediaShowVoipItems) {
						mediaFilters['filter_not_ui_metadata.origin'] = 'voip';
					}

					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId,
							filters: mediaFilters
						},
						success: function (mediaList, status) {
							_.each(mediaList.data, function (media) {
								if (media.media_source) {
									media.name = '[' + media.media_source.substring(0, 3).toUpperCase() + '] ' + media.name;
								}
							});

							mediaList.data.unshift({
								id: '',
								name: self.i18n.active().callflows.menu.not_set
							});

							defaults.field_data.media = mediaList.data;
							callback(null, mediaList);
						}
					});
				},
				user_list: function (callback) {
					self.getUsersList(function (users) {

						users = _.orderBy(users, ['last_name', 'first_name'], ['asc', 'asc']);
						
						defaults.field_data.users = users;

						if (typeof data === 'object' && data.id) {
							self.queueGet(data.id, function (queueData) {
								var render_data = $.extend(true, defaults, queueData);

								render_data.field_data.old_list = [];
								if ('agents' in queueData.data) {
									render_data.field_data.old_list = queueData.data.agents;
								}
								callback(null, {});
							});
						} else {
							callback(null, {});
						}
					});
				},
				callflow_list: function (callback) {
					self.getCallflowList(function (callflows) {
						callflows.unshift({
							id: '',
							name: self.i18n.active().callflows.acdc.notSet
						});
						defaults.field_data.callflows = callflows;
						callback(null, callflows);
					})
				}
			};

			// conditionally add `agent_status` to the parallel tasks if this is an existing queue
			if (data && data.id) {
				parallelTasks.agent_status = function (callback) {
					monster.request({
						resource: 'callcenter.agents.state',
						data: {
							accountId: self.accountId,
							queuesId: queueId,
							filters: { 
								paginate: false 
							}
						},
						success: function(data, status) {
							agentList = data
							defaults.field_data.agents = agentList.data;
							callback(null, agentList);
						},
						error: function (data) {
							callback(null, {});  
						}
					});
				};
			}

			// execute the parallel tasks
			monster.parallel(parallelTasks, function (err, results) {
				let render_data = defaults;

				if (typeof data === 'object' && data.id) {

					render_data = $.extend(true, defaults, results.user_list);

					self.findQueueCallflow(data.id, function(callflow) {

						var queueCallflowId = callflow.id,
							queueExtension = callflow.numbers[0];

						render_data.field_data.callflow_id = queueCallflowId;
						render_data.field_data.queue_extension = queueExtension;

						self.getTimeoutCallflow(queueCallflowId, function(timeoutCallflow) {

							// check if timeoutCallflow exists in callflow_list
							var itemNotFound = timeoutCallflow && !_.some(results.callflow_list || [], function(cf) {
								return cf && cf.id === timeoutCallflow;
							});

							render_data.field_data.timeout_callflow = timeoutCallflow || '';

							if (itemNotFound) {
								render_data.field_data.timeout_callflow_missing = true;
								render_data.field_data.timeout_callflow_missing_text = self.i18n.active().callflows.acdc.callflowNotFound;
							}

							self.queueRender(render_data, target, callbacks);

							if (typeof callbacks.after_render === 'function') {
								callbacks.after_render();
							}
						});
		
					});

					return; // prevent fall-through (render happens in callbacks above)

				}

				render_data.field_data.timeout_callflow = '';
				self.queueRender(render_data, target, callbacks);

				if (typeof callbacks.after_render === 'function') {
					callbacks.after_render();
				}
			});

		},

		getUsersList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId,
					filters: { paginate: false },
					generateError: false
				},
				success: function(users, status) {
					callback && callback(users.data);
				}
			});
		},

		// callflow list for queue timeout
		getCallflowList: function(callback) {
			var self = this;

			var callflowFilters = {
				paginate: false,
				filter_not_numbers: 'no_match',
				filter_not_name: 'Dimensions_ReservedFeatureCodes'
			};

			var hideDimensionDeviceCallflow = [];

			// are custom callflow actions enabled
			if (miscSettings && miscSettings.enableCustomCallflowActions) {
				if (miscSettings.callflowActionHideSmartPbxCallflows) {
					callflowFilters['filter_not_type'] = 'mainUserCallflow';
				}
				if (miscSettings.callflowActionHideOriginVoip) {
					callflowFilters['filter_not_ui_metadata.origin'] = 'voip';
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
				success: function (callflows) {
					var list_callflows = [];

					$.each(callflows.data, function () {
						if (this.featurecode === false) {
							list_callflows.push(this);
						}
					});

					list_callflows.sort(function (a, b) {
						var aName = (a.name || (a.numbers && a.numbers[0] + '') || '').toLowerCase(),
							bName = (b.name || (b.numbers && b.numbers[0] + '') || '').toLowerCase();

						return aName > bName ? 1 : -1;
					});

					callback && callback(list_callflows);
				}
			});

		},

		queueRenderList: function(_parent, callback) {
			var self = this,
				parent = _parent || $('#queue-content'),
				i18nApp = self.i18n.active().callflows.callcenter;

			self.getQueuesList(function(data) {
				var map_crossbar_data = function(data) {
					var new_list = [];

					if (data.length > 0) {
						$.each(data, function(key, val) {
							new_list.push({
								id: val.id,
								title: val.name || i18nApp.noName
							});
						});
					}

					new_list.sort(function(a, b) {
						return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
					});

					return new_list;
				};

				callback && callback();
			});
		},

		getQueuesList: function(callback) {
			var self = this;
			monster.request({
				resource: 'callcenter.queues.list',
				data: {
					accountId: self.accountId,
					generateError: false
				},
				success: function(data) {
					// Sort the data based on the 'name' field
					data.data.sort(function(a, b) {
						return a.name.localeCompare(b.name);
					});
					
					callback && callback(data.data);
				}
			});
		},

		queueGet: function(queueId, callback) {
			var self = this;
			monster.request({
				resource: 'callcenter.queues.get',
				data: {
					accountId: self.accountId,
					queuesId: queueId,
					generateError: false
				},
				success: function(_data) {
					if (typeof (callback) === 'function') {
						callback(_data);
					}
				}
			});
		},

		findQueueCallflow: function(queueId, callback) {
			var self = this;

			var callflowFilters = {
				paginate: false,
				'filter_owner_id': queueId
			};

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: callflowFilters
				},
				success: function(_data) {

					var callflow = _data?.data?.[0] || null;

					callback && callback(callflow);
				}
			});
		},

		getCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: callflowId
				},
				success: function(_data) {
					callback && callback(_data.data || []);
				}
			});
		},

		listQueueCallflows: function(callback) {
			var self = this;

			var callflowFilters = {
				paginate: false,
				'filter_flow.module': 'acdc_member'
			};

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: callflowFilters
				},
				success: function(_data) {
					callback && callback(_data.data || []);
				}
			});
		},

		getTimeoutCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: callflowId
				},
				success: function(resp) {
					var timeoutCallflow = resp.data.flow.children?._?.data?.id || null;
					callback && callback(timeoutCallflow);
				}
			});
		},

		queueRender: function(data, target, callbacks) {

			fieldReadOnly = false;

			if (data.data.hasOwnProperty('strategy')) {
				fieldReadOnly = true
			}

			var self = this;
			data.i18nApp = self.i18n.active().callflows.callcenter;
			var queue_html = $(self.getTemplate({
				name: 'edit',
				data: {
					...data,
					miscSettings: miscSettings,
					fieldReadOnly: fieldReadOnly
				},
				submodule: 'callcenter'
			}));

			self.userListRender(data, queue_html);

			var $form = queue_html.find('form');

			monster.ui.validate($form, {
				rules: self.validationRules
			});

			// monster.ui.tooltips(queue_html, {
			// 	selector: '[rel=popover]'
			// });

			$('*[rel=popover]', queue_html).popover({
				trigger: 'focus',
				placement: 'right'
			});

			$('.queue-save', queue_html).click(function(ev) {
				saveButtonEvents(ev);
			});

			$('#submodule-buttons-container .save').click(function(ev) {
				saveButtonEvents(ev);
			});

			function saveButtonEvents(ev) {
				ev.preventDefault();

				if (monster.ui.valid($form)) {
					var form_data = monster.ui.getFormData($form[0]);
					
					var existingExtension = data.field_data?.queue_extension,
						formExtension = form_data.extension,
						extensionChanged = existingExtension !== formExtension,
						existingTimeout = data.field_data?.timeout_callflow,
						formTimeout = form_data.timeout_callflow_id,
						timeoutChanged = existingTimeout !== formTimeout,
						timeoutMissing = data.field_data?.timeout_callflow_missing;

					if (formExtension == "") {
						monster.ui.alert('warning', self.i18n.active().callflows.acdc.extension.extensionNumberRequired);
						return; // exit early to prevent save
					}

					if (timeoutMissing && formTimeout == 'null') {
						monster.ui.alert('warning', self.i18n.active().callflows.acdc.timeout.timeoutMissing);
						return; // exit early to prevent save
					}

					if (extensionChanged) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: {
									filter_numbers: formExtension,
									paginate: false
								}
							},
							success: function(_data) {
								if (_data.data.length > 0) {
									var callflowName = _data.data[0].name;
									monster.ui.alert('warning', self.i18n.active().callflows.acdc.extension.extensionNumberExists + callflowName);
									return; // exit early to prevent save
								} else {
									data.field_data.update_callflow = true;
									processUserListAndSave(form_data, data, queue_html, callbacks);
								}
							}
						});
					} else {
						// no extension change, update callflow if timeout changed
						data.field_data.update_callflow = timeoutChanged;
						processUserListAndSave(form_data, data, queue_html, callbacks);
					}

				} else {
					toastr.error(self.i18n.active().callflows.callcenter.formHasErrorsMessage);
				}
			};

			function processUserListAndSave(form_data, data, queue_html, callbacks) {
				const agentsList = [];

				$('.js-user-table-item:not(#row_no_data)', queue_html).each(function () {
					agentsList.push($(this).data('id'));
				});

				data.field_data.user_list = {
					old_list: data.data.agents || [],
					new_list: agentsList
				};

				self.queueSave(form_data, data, callbacks.save_success, callbacks.save_error);
			}


			$('.queue-delete', queue_html).click(function(ev) {
				deleteButtonEvents(ev);
			});

			$('#submodule-buttons-container .delete').click(function(ev) {
				deleteButtonEvents(ev);
			});

			function deleteButtonEvents(ev) {
				ev.preventDefault();
				monster.ui.confirm(self.i18n.active().callflows.callcenter.deleteConfirmMessage, function() {
					self.queueDelete(data, callbacks.delete_success, callbacks.delete_error);
				});
			};

			$('.add-user', queue_html).on('click', function(e) {
				e.preventDefault();

				var $userSelect = $('#users-list', queue_html);
				var user_id = $userSelect.val();

				if (!user_id || user_id === 'null') {
					return;
				}

				var user_name = $.trim($userSelect.find('option:selected').text());

				$('#row_no_data', queue_html).remove();

				$('.js-user-table-body', queue_html).prepend(
					$(self.getTemplate({
						name: 'user-row',
						data: {
							user_id: user_id,
							user_name: user_name,
							agent_status: '',
							miscSettings: miscSettings
						},
						submodule: 'callcenter'
					}))
				);

				$userSelect.find('option[value="' + user_id + '"]').remove();
				$userSelect.val('null');
				$userSelect.trigger('chosen:updated');
			});

			$(queue_html).on('click', '.js-delete-user', function(e) {
				e.preventDefault();

				var user_id = String($(this).data('id'));
				var $row = $('#row_user_' + user_id, queue_html);

				var user_name = $.trim($row.find('td').eq(0).text());

				$row.remove();

				var $userSelect = $('#users-list', queue_html);

				var $opt = $userSelect.find('option[value="' + user_id + '"]');

				if (!$opt.length) {
					$opt = $('<option>', {
						value: user_id,
						id: 'option_user_' + user_id,
						text: user_name
					}).appendTo($userSelect);
				} else {
					$opt.text(user_name);
				}

				$opt.prop('disabled', false);
				$opt.removeAttr('style');

				$userSelect.trigger('chosen:updated');
				$userSelect.trigger('liszt:updated');

				if ($('.js-user-table-body .js-user-table-item', queue_html).length === 0) {
					$('.js-user-table-body', queue_html).append(
						$(self.getTemplate({
							name: 'user-row',
							data: {},
							submodule: 'callcenter'
						}))
					);
				}
			});

			$('#connection_timeout', queue_html).change(function() {			
				inputValue = $('#connection_timeout', queue_html).val();
				if (inputValue < 20 || inputValue > 3600) {
					$('#connection_timeout', queue_html).val(20);
					monster.ui.alert('warning', self.i18n.active().callflows.acdc.settings.connectionTimeoutInvalid);
				}
			});

			$('#announcements_interval', queue_html).change(function() {			
				inputValue = $('#announcements_interval', queue_html).val();
				if (inputValue < 15 || inputValue > 30) {
					$('#announcements_interval', queue_html).val(15);
					monster.ui.alert('warning', self.i18n.active().callflows.acdc.announcements.intervalInvalid);
				}
			});

			$('#max_queue_size', queue_html).change(function() {			
				inputValue = $('#max_queue_size', queue_html).val();
				if (inputValue < 0 || inputValue > 100) {
					$('#max_queue_size', queue_html).val(0);
					monster.ui.alert('warning', self.i18n.active().callflows.acdc.settings.maxQueueSizeInvalid);
				}
			});

			$('#agent_ring_timeout', queue_html).change(function() {			
				inputValue = $('#agent_ring_timeout', queue_html).val();
				if (inputValue < 5 || inputValue > 120) {
					$('#agent_ring_timeout', queue_html).val(15);
					monster.ui.alert('warning', self.i18n.active().callflows.acdc.agents.agentTimeoutInvalid);
				}
			});

			$('#agent_wrapup_time', queue_html).change(function() {			
				inputValue = $('#agent_wrapup_time', queue_html).val();
				if (inputValue < 0 || inputValue > 300) {
					$('#agent_wrapup_time', queue_html).val(0);
					monster.ui.alert('warning', self.i18n.active().callflows.acdc.agents.agentWrapupInvalid);
				}
			});

			$(queue_html).on('click', '.search-extension-link', function() {
				monster.pub('common.extensionTools.select', {
					callback: function(number) {
						$(queue_html).find('#extension').val(number);
					}
				});
			});

			//show message if timeout callflow has been deleted 
			if (data.field_data.timeout_callflow_missing) {
				var missingText = data.field_data.timeout_callflow_missing_text,
					$timeout = queue_html.find('#timeout_callflow_id');

				$timeout.attr('data-placeholder', missingText).addClass('item-not-found');
			}

			// add search to dropdown
			queue_html.find('#moh').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			queue_html.find('#timeout_callflow_id').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			queue_html.find('#users-list').chosen({
				width: '224px',
				disable_search_threshold: 0,
				search_contains: true
			})

			self.winkstartTabs(queue_html);
			self.winkstartLinkForm(queue_html);

			self.queueBindEvents({
				data: data,
				template: queue_html,
				callbacks: callbacks
			});

			target.empty().append(queue_html);
		},

		agentsSave: function(queueId, agentsIdList, callback) {
			var self = this;

			monster.request({
				resource: 'callcenter.agents.update',
				data: {
					accountId: self.accountId,
					generateError: false,
					queuesId: queueId,
					data: agentsIdList
				},
				success: function(data) {
					if (typeof (callback) === 'function' && data.data) {
						callback(data.data);
					}
				}
			});
		},

		queueDelete: function(data, success, error) {
			var self = this;

			if (typeof data.data === 'object' && data.data.id) {
				self.queueCallflowDelete(data, function() {
					monster.request({
						resource: 'callcenter.queues.delete',
						data: {
							accountId: self.accountId,
							queuesId: data.data.id,
							generateError: false
						},
						success: function(_data, status) {
							if (typeof success === 'function') {
								success(_data, status);
							}
						},
						error: function(_data, status) {
							if (typeof error === 'function') {
								error(_data, status);
							}
						}
					});
				});				
			}
		},

		queueCallflowDelete: function(data, success, error) {
			var self = this;

			var callflowId = data.field_data.callflow_id;

			if (callflowId) {
				self.callApi({
					resource: 'callflow.delete',
					data: {
						accountId: self.accountId,
						callflowId: callflowId
					},
					success: function() {
						if (typeof success === 'function') {
							success();
						}
					}
				});
			} else {
				if (typeof success === 'function') {
					success();
				}
			}
		},

		userListRender: function(data, parent) {
			var self = this;

			if (data.data.id) {
				if ('agents' in data.data && data.data.agents.length > 0) {
					var user_item;
					$.each(data.field_data.users, function(k, v) {
						if (data.data.agents.indexOf(v.id) >= 0) {

							// check if field_data.agents exists before trying to access it
							var agentStatus = (data.field_data.agents && data.field_data.agents[v.id]) ? data.field_data.agents[v.id].status : 'Logged Out';
					  
							// function to format the status
							function formatStatus(status) {
								return status
									.toLowerCase()                            
									.replace(/_/g, ' ')                       
									.replace(/\b\w/g, function(match) {
										return match.toUpperCase();
									});
							}

							agentStatus = formatStatus(agentStatus);

							var html = $(self.getTemplate({
								name: 'user-row',
								data: {
									user_id: v.id,
									user_name: v.first_name + ' ' + v.last_name,
									agent_status: agentStatus,
									miscSettings: miscSettings
								},
								submodule: 'callcenter'
							}));

							$('.js-user-table-body', parent).append(html);
							$('#option_user_' + v.id, parent).hide();
						}
					});
				} else {
					$('.js-user-table-body', parent).empty()
						.append(
							$(self.getTemplate({
								name: 'user-row',
								data: {},
								submodule: 'callcenter'
							}))
						);
				}
			} else {
				$('.js-user-table-body', parent).empty()
					.append(
						$(self.getTemplate({
							name: 'user-row',
							data: {},
							submodule: 'callcenter'
						}))
					);
			}
		},

		queueSave: function(form_data, data, success, error) {
			var self = this,
				extensionNumber = form_data.extension,
				updateCallflow = data.field_data.update_callflow,
				normalized_data = self.normalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data === 'object' && data.data.id) {
				var queueId = data.data.id,
					callflowId = data.field_data.callflow_id,
					timeoutCallflow = form_data.timeout_callflow_id || null;

				self.queueUpdate(queueId, normalized_data, extensionNumber, updateCallflow, callflowId, timeoutCallflow, function(queueData) {
					data.field_data.queue_extension = extensionNumber;
					self.agentsSave(queueId, data.field_data.user_list.new_list, function(agentsData) {
						queueData.agents = agentsData.agents;
						if (typeof (success) === 'function') {
							success(queueData);
						}
					});
				});
			} else {
				self.queueCreate(normalized_data, extensionNumber, timeoutCallflow, function(queueData) {
					data.field_data.queue_extension = extensionNumber;
					self.agentsSave(queueData.id, data.field_data.user_list.new_list, function(agentsData) {
						queueData.agents = agentsData.agents;
						if (typeof (success) === 'function') {
							success(queueData);
						}
					});
				});
			}
		},

		queueUpdate: function(queueId, data, extensionNumber, updateCallflow, callflowId, timeoutCallflow, success, error){
			var self = this;

			monster.request({
				resource: 'callcenter.queues.update',
				data: {
					accountId: self.accountId,
					queuesId: queueId,
					generateError: false,
					data: data
				},
				success: function(_data) {
					if (updateCallflow) {
						self.queueCallflowUpdate(_data.data, extensionNumber, callflowId, timeoutCallflow, function() {
							if (typeof (success) === 'function') {
								success(_data.data);
							}
						});
					} else {
						if (typeof (success) === 'function') {
							success(_data.data);
						}
					}
				},
				error: function(_data) {
					if (typeof (error) === 'function') {
						error(_data);
					}
				}
			});
		},

		queueCreate: function(data, extensionNumber, timeoutCallflow, success, error) {
			var self = this;

			monster.request({
				resource: 'callcenter.queues.create',
				data: {
					accountId: self.accountId,
					generateError: false,
					data: data
				},
				success: function(_data) {
					self.queueCallflowCreate(_data.data, extensionNumber, timeoutCallflow, function() {
						if (typeof (success) === 'function') {
							success(_data.data);
						}
					});
				},
				error: function(_data) {
					if (typeof (error) === 'function') {
						error(_data);
					}
				}
			});
		},

		queueCallflowCreate: function(data, extensionNumber, timeoutCallflow, success, error) {
			var self = this;

			var children = {};

			if (timeoutCallflow) {
				children["_"] = {
					module: "callflow",
					data: {
						id: timeoutCallflow
					},
					children: {}
				};
			}

			self.callApi({
				resource: 'callflow.create',
				data: {
					accountId: self.accountId,
					data: {
						name: data.name,
						numbers: [ extensionNumber ],
						flow: {
							data: {
								id: data.id,
								priority: 1
							},
							module: 'acdc_member',
							children: children
						},
						owner_id: data.id,
						ui_metadata: {
							origin: 'voip'
						}
					},
					removeMetadataAPI: true
				},
				success: function(_data) {
					if (typeof (success) === 'function') {
						success(_data.data);
					}
				}
			});
		},

		queueCallflowUpdate: function(data, extensionNumber, callflowId, timeoutCallflow, success, error) {
			var self = this;

			var children = {};

			if (timeoutCallflow) {
				children["_"] = {
					module: "callflow",
					data: {
						id: timeoutCallflow
					},
					children: {}
				};
			}

			self.callApi({
				resource: 'callflow.update',
				data: {
					accountId: self.accountId,
					callflowId: callflowId,
					data: {
						name: data.name,
						numbers: [ extensionNumber ],
						flow: {
							data: {
								id: data.id,
								priority: 1
							},
							module: 'acdc_member',
							children: children
						},
						owner_id: data.id,
						ui_metadata: {
							origin: 'voip'
						}
					},
					removeMetadataAPI: true
				},
				success: function(_data) {
					if (typeof (success) === 'function') {
						success(_data.data);
					}
				}
			});
		},

		normalizeData: function(form_data) {
			delete form_data.user_id;
			delete form_data.extension;
			delete form_data.timeout_callflow_id;

			// remove blank fields and let Kazoo set the defaults
			$.each(form_data, function(key, value){
				if (value === "" || value === null){
					delete form_data[key];
				}
			});

			return form_data;
		},

		queueBindEvents: function (args) {
			var self = this,
				data = args.data,
				callbacks = args.callbacks,
				queue_html = args.template;

			$('.inline_action_media', queue_html).click(function (ev) {
				var _data = ($(this).data('action') === 'edit') ? {id: $('#announce', queue_html).val()} : {},
					_id = _data.id;

				ev.preventDefault();

				monster.pub('callflows.media.editPopup', {
					data: _data,
					callback: function (media) {
						/* Create */
						if (!_id) {
							$('#announce', queue_html).append('<option id="' + media.id + '" value="' + media.id + '">' + media.name + '</option>');
							$('#announce', queue_html).val(media.id);

							$('#edit_link_media', queue_html).show();
						} else {
							/* Update */
							if (media.hasOwnProperty('id')) {
								$('#announce #' + media.id, queue_html).text(media.name);
								/* Delete */
							} else {
								$('#announce #' + _id, queue_html).remove();
								$('#edit_link_media', queue_html).hide();
							}
						}
					}
				});
			});

		},

		queueSubmoduleButtons: function(data) {
			var existingItem = true;
			
			if (!data.id) {
				existingItem = false;
			}
			
			var self = this,
				buttons = $(self.getTemplate({
					name: 'submoduleButtons',
					data: {
						miscSettings: miscSettings,
						existingItem: existingItem
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