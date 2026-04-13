define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
        miscSettings = {};

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'eavesdropDefineActions'
		},

		eavesdropDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
                hideCallflowAction = args.hideCallflowAction;

            // set variables for use elsewhere
            miscSettings = args.miscSettings;

            // function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			};

			$.extend(callflow_nodes, {

				
				'eavesdrop[]': {
					name: self.i18n.active().callflows.eavesdrop.name,
					icon: 'headphones',
                    google_icon: 'hearing',
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
                    isTerminating: 'true',
					isUsable: 'true',
                    isListed: determineIsListed('eavesdrop[]'),
					weight: 65,
					caption: function(node, caption_map) {
						var id = node.data.data.device_id || node.data.data.user_id,
							return_value = '';

						if (id) {
							if (caption_map.hasOwnProperty(id) && caption_map[id].hasOwnProperty('name')) {
								return_value = caption_map[id].name;
							} 
						}
						return return_value;
					},
					edit: function(node, callback) {
						self.eavesdropGetEndpoints(function(formattedData) {
							var popup, popup_html;                          

							popup_html = $(self.getTemplate({
								name: 'eavesdrop',
								data: {
									fieldData: formattedData,
									data: {
										'approvedDeviceId': node.getMetadata('approved_device_id') || '',
										'approvedUserId': node.getMetadata('approved_user_id') || '',
                                        'approvedGroupId': node.getMetadata('approved_group_id') || '',
                                       	'targetDeviceId': node.getMetadata('device_id') || '',
                                        'targetUserId': node.getMetadata('user_id') || ''
                                    }
								},
								submodule: 'eavesdrop'
							}));

							// add search to dropdown
							popup_html.find('#approved_device_selector, #approved_user_selector, #approved_group_selector, #target_device_selector, #target_user_selector').chosen({
								width: '100%',
								disable_search_threshold: 0,
								search_contains: true
							}).on('chosen:showing_dropdown', function() {
								popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
							});

							popup_html.find('.select_wrapper').addClass('eavesdrop_dialog_popup');

                            // enable or disable the save button based on the dropdown value
                            function toggleSaveButton() {
                                var approvedDeviceValue = $('#approved_device_selector', popup_html).val(), 
									approvedUserValue = $('#approved_user_selector', popup_html).val(),
                                    approvedGroupValue = $('#approved_group_selector', popup_html).val(),
                                    targetDeviceValue = $('#target_device_selector', popup_html).val(),
									targetUserValue = $('#target_user_selector', popup_html).val();

                                if ((approvedDeviceValue != 'null' || approvedUserValue != 'null' || approvedGroupValue != 'null') && (targetDeviceValue !='null' || targetUserValue != 'null')) {
                                    $('#add', popup_html).prop('disabled', false);
                                } else {
                                    $('#add', popup_html).prop('disabled', true);
                                }
                            }

                            toggleSaveButton();

                            $('#approved_device_selector', popup_html).change(toggleSaveButton);
							$('#approved_user_selector', popup_html).change(toggleSaveButton);
                            $('#approved_group_selector', popup_html).change(toggleSaveButton);
                            $('#target_device_selector', popup_html).change(toggleSaveButton);
                            $('#target_user_selector', popup_html).change(toggleSaveButton);

							function approvedDeviceChanged() {
								var deviceValue = $('#approved_device_selector', popup_html).val(),
									userValue = $('#approved_user_selector', popup_html).val(),
									groupValue = $('#approved_group_selector', popup_html).val();
							
								if ((deviceValue != 'null' && userValue != 'null') || (deviceValue != 'null' && groupValue != 'null')) {
									$('#approved_user_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
							
									$('#approved_group_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#approved_device_selector', popup_html).change(approvedDeviceChanged);
							
							function approvedUserChanged() {
								var deviceValue = $('#approved_device_selector', popup_html).val(),
									userValue = $('#approved_user_selector', popup_html).val(),
									groupValue = $('#approved_group_selector', popup_html).val();
							
								if ((userValue != 'null' && deviceValue != 'null') || (userValue != 'null' && groupValue != 'null')) {
									$('#approved_device_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
							
									$('#approved_group_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#approved_user_selector', popup_html).change(approvedUserChanged);
							
							function approvedGroupChanged() {
								var deviceValue = $('#approved_device_selector', popup_html).val(),
									userValue = $('#approved_user_selector', popup_html).val(),
									groupValue = $('#approved_group_selector', popup_html).val();
							
								if ((groupValue != 'null' && deviceValue != 'null') || (groupValue != 'null' && userValue != 'null')) {
									$('#approved_device_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
							
									$('#approved_user_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#approved_group_selector', popup_html).change(approvedGroupChanged);
							
							function targetDeviceChanged() {
								var deviceValue = $('#target_device_selector', popup_html).val(),
									userValue = $('#target_user_selector', popup_html).val();
							
								if (deviceValue != 'null' && userValue != 'null') {
									$('#target_user_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#target_device_selector', popup_html).change(targetDeviceChanged);
							
							function targetUserChanged() {
								var userValue = $('#target_user_selector', popup_html).val(),
									deviceValue = $('#target_device_selector', popup_html).val();
							
								if (userValue != 'null' && deviceValue != 'null') {
									$('#target_device_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#target_user_selector', popup_html).change(targetUserChanged);
							
							$('#add', popup_html).click(function() {

                                var setData = function(field, value) {
                                    if (value !== 'null') {
                                        node.setMetadata(field, value);
                                    } else {
                                        node.deleteMetadata(field);
                                    }
                                };

                                setData('approved_device_id', $('#approved_device_selector', popup_html).val());
								setData('approved_user_id', $('#approved_user_selector', popup_html).val());
                                setData('approved_group_id', $('#approved_group_selector', popup_html).val());
                                setData('device_id', $('#target_device_selector', popup_html).val());
                                setData('user_id', $('#target_user_selector', popup_html).val());

								var deviceCaption = $('#target_device_selector option:selected', popup_html).text(),
									userCaption = $('#target_user_selector option:selected', popup_html).text();

								if (deviceCaption !== "" ) {
									node.caption = deviceCaption;
								}
								
								if (userCaption !== "") {
									node.caption = userCaption;
								}
                               
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
				},
				
				
				'eavesdrop_feature[]': {
					name: self.i18n.active().callflows.eavesdropFeature.name,
					icon: 'headphones',
                    google_icon: 'hearing',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'eavesdrop_feature',
					tip: self.i18n.active().callflows.eavesdropFeature.tip,
					data: {},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
                    isTerminating: 'true',
					isUsable: 'true',
                    isListed: determineIsListed('eavesdrop_feature[]'),
					weight: 66,
					caption: function(node, caption_map) {
						var id = node.data.data.device_id,
							return_value = '';

						if (id) {
							if (caption_map.hasOwnProperty(id) && caption_map[id].hasOwnProperty('name')) {
								return_value = caption_map[id].name;
							} 
						}

						return return_value;
					},
					edit: function(node, callback) {
						self.eavesdropGetEndpoints(function(formattedData) {
							var popup, popup_html;                          

							popup_html = $(self.getTemplate({
								name: 'eavesdropFeature',
								data: {
									fieldData: formattedData,
									data: {
										'approvedUserId': node.getMetadata('approved_user_id') || '',
                                        'approvedGroupId': node.getMetadata('approved_group_id') || '',
                                        'targetUserId': node.getMetadata('device_id') || '',
                                        'targetGroupId': node.getMetadata('device_id') || ''
                                    }
								},
								submodule: 'eavesdrop'
							}));

							// add search to dropdown
							popup_html.find('#approved_user_selector, #approved_group_selector, #target_user_selector, #target_group_selector').chosen({
								width: '100%',
								disable_search_threshold: 0,
								search_contains: true
							}).on('chosen:showing_dropdown', function() {
								popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
							});

							popup_html.find('.select_wrapper').addClass('eavesdrop_dialog_popup');
							
                            // enable or disable the save button based on the dropdown value
                            function toggleSaveButton() {
                                var approvedUserValue = $('#approved_user_selector', popup_html).val(),
                                    approvedGroupValue = $('#approved_group_selector', popup_html).val(),
                                    targetUserValue = $('#target_user_selector', popup_html).val(),
                                    targetGroupValue = $('#target_group_selector', popup_html).val();

                                if ((approvedUserValue != 'null' || approvedGroupValue != 'null') && (targetUserValue != 'null' || targetGroupValue !='null')) {
                                    $('#add', popup_html).prop('disabled', false);
                                } else {
                                    $('#add', popup_html).prop('disabled', true);
                                }
                            }

                            toggleSaveButton();

                            $('#approved_user_selector', popup_html).change(toggleSaveButton);
                            $('#approved_group_selector', popup_html).change(toggleSaveButton);
                            $('#target_user_selector', popup_html).change(toggleSaveButton);
                            $('#target_group_selector', popup_html).change(toggleSaveButton);

							function approvedUserChanged() {
								var userValue = $('#approved_user_selector', popup_html).val(),
									groupValue = $('#approved_group_selector', popup_html).val();
							
								if (userValue != 'null' && groupValue != 'null') {
									$('#approved_group_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#approved_user_selector', popup_html).change(approvedUserChanged);
							
							function approvedGroupChanged() {
								var groupValue = $('#approved_group_selector', popup_html).val(),
									userValue = $('#approved_user_selector', popup_html).val();
							
								if (groupValue != 'null' && userValue != 'null') {
									$('#approved_user_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#approved_group_selector', popup_html).change(approvedGroupChanged);

							function targetUserChanged() {
								var userValue = $('#target_user_selector', popup_html).val(),
									groupValue = $('#target_group_selector', popup_html).val();
							
								if (userValue != 'null' && groupValue != 'null') {
									$('#target_group_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#target_user_selector', popup_html).change(targetUserChanged);
							
							function targetGroupChanged() {
								var groupValue = $('#target_group_selector', popup_html).val(),
									userValue = $('#target_user_selector', popup_html).val();
							
								if (groupValue != 'null' && userValue != 'null') {
									$('#target_user_selector', popup_html)
										.val('null')
										.trigger('chosen:updated')
										.trigger('change');
								}
							}
							
							$('#target_group_selector', popup_html).change(targetGroupChanged);

							$('#add', popup_html).click(function() {

                                var setData = function(field, value) {
                                    if (field == 'target_user_id' && value != 'null') {
                                        node.setMetadata('device_id', value);
                                    } else if (field == 'target_group_id' && value != 'null') {
                                        node.setMetadata('device_id', value);
                                    } else if (value !== 'null') {
                                        node.setMetadata(field, value);
                                    } else {
                                        node.deleteMetadata(field);
                                    }
                                };

                                setData('approved_user_id', $('#approved_user_selector', popup_html).val());
                                setData('approved_group_id', $('#approved_group_selector', popup_html).val());
                                setData('target_user_id', $('#target_user_selector', popup_html).val());
                                setData('target_group_id', $('#target_group_selector', popup_html).val());

								var userCaption = $('#target_user_selector option:selected', popup_html).text(),
									groupCaption = $('#target_group_selector option:selected', popup_html).text();

								if (userCaption !== "" ) {
									node.caption = userCaption;
								}
								
								if (groupCaption !== "") {
									node.caption = groupCaption;
								}
							
								popup.dialog('close');

							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.eavesdropFeature.title,
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						});
					}
				}
			});
		},

		eavesdropGetEndpoints: function(callback) {
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
				var data = self.eavesdropFormatEndpoints(results);

				callback(data);
			});
		},

		eavesdropFormatEndpoints: function(data) {
			_.each(data.user, function(user) {
				user.name = user.first_name + ' ' + user.last_name;
			});

			return data;
		}
	};

	return app;
});