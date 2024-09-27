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
				i18nApp = self.i18n.active().callflows.callcenter,
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
						});
					},
					listEntities: function(callback) {
						monster.request({
							resource: 'callcenter.queues.list',
							data: {
								accountId: self.accountId
							},
							success: function(data, status) {
								// Sort the data based on the 'name' field
								data.data.sort(function(a, b) {
									return a.name.localeCompare(b.name);
								});
					
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.queue.edit'
				},
				'acdc_agent[action=resume]': {
					name: self.i18n.active().callflows.acdc.callflowActions.agentResume,
					icon: 'check_circle',
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
					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
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
				}
			  
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

					var agentsList = [];

					$('.js-user-table-item:not(#row_no_data)', queue_html).each(function() {
						agentsList.push($(this).data('id'));
					});

					data.field_data.user_list = {
						old_list: data.data.agents || [],
						new_list: agentsList
					};

					self.queueSave(form_data, data, callbacks.save_success, callbacks.save_error);
				} else {
					toastr.error(self.i18n.active().callflows.callcenter.formHasErrorsMessage);
				}
			};

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

			$('.add-user', queue_html).click(function(e) {
				e.preventDefault();

				var $userSelect = $('#users-list', queue_html);

				if ($userSelect.val() !== 'empty_option_user') {
					var user_id = $userSelect.val(),
						user_data = {
							user_id: user_id,
							user_name: $('#option_user_' + user_id, queue_html).text()
						};

					if ($('#row_no_data', queue_html).size() > 0) {
						$('#row_no_data', queue_html).remove();
					}

					$('.js-user-table-body', queue_html).prepend(
						$(self.getTemplate({
							name: 'user-row',
							data: user_data,
							submodule: 'callcenter'
						}))
					);
					$('#option_user_' + user_id, queue_html).hide();

					$userSelect.val('empty_option_user');
				}
			});

			$(queue_html).on('click', '.js-edit-user', function() {
				var _data = {
					id: $(this).data('id')
				};

				monster.pub('callflows.user.popupEdit', {
					data: _data,
					callflow: function(_data) {
						$('#row_user_' + _data.data.id + ' .column.first', queue_html).html(_data.data.first_name + ' ' + _data.data.last_name);
						$('#option_user_' + _data.data.id, queue_html).html(_data.data.first_name + ' ' + _data.data.last_name);
					}
				});
			});

			$(queue_html).on('click', '.js-delete-user', function() {
				var user_id = $(this).data('id');

				//removes it from the grid
				$('#row_user_' + user_id, queue_html).remove();

				//re-add it to the dropdown
				$('#option_user_' + user_id, queue_html).show();

				//if grid empty, add no data line
				if ($('.js-user-table-body .js-user-table-item', queue_html).size() === 0) {
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
									agent_status: agentStatus
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
				normalized_data = self.normalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data === 'object' && data.data.id) {
				var queueId = data.data.id;
				self.queueUpdate(queueId, normalized_data, function(queueData) {
					self.agentsSave(queueId, data.field_data.user_list.new_list, function(agentsData) {
						queueData.agents = agentsData.agents;
						if (typeof (success) === 'function') {
							success(queueData);
						}
					});
				});
			} else {
				self.queueCreate(normalized_data, function(queueData) {
					self.agentsSave(queueData.id, data.field_data.user_list.new_list, function(agentsData) {
						queueData.agents = agentsData.agents;
						if (typeof (success) === 'function') {
							success(queueData);
						}
					});
				});
			}
		},

		queueUpdate: function(queueId, data, success, error){
			var self = this;

			monster.request({
				resource: 'callcenter.queues.update',
				data: {
					accountId: self.accountId,
					queuesId: queueId,
					generateError: false,
					data: data
				},
				success: function(data) {
					if (typeof (success) === 'function' && data.data) {
						success(data.data);
					}
				},
				error: function(data) {
					if (typeof (error) === 'function') {
						error(data);
					}
				}
			});
		},

		queueCreate: function(data, success, error) {
			var self = this;

			monster.request({
				resource: 'callcenter.queues.create',
				data: {
					accountId: self.accountId,
					generateError: false,
					data: data
				},
				success: function(_data) {
					if (typeof (success) === 'function') {
						success(_data.data);
					}
				},
				error: function(_data) {
					if (typeof (error) === 'function') {
						error(_data);
					}
				}
			});
		},

		normalizeData: function(form_data) {
			delete form_data.user_id;

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