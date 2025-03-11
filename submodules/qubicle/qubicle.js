define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'qubicleDefineActions'
		},

		qubicleDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions,
				hideCallflowAction = args.hideCallflowAction;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
			};

			var actions = {
				'qubicle[id=*]': {
					name: self.i18n.active().callflows.qubicle.qubicle,
					icon: 'support',
					google_icon: 'support_agent',
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'qubicle',
					tip: self.i18n.active().callflows.qubicle.qubicle_tip,
					data: {
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('qubicle[id=*]'),
					weight: 30,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						self.qubicleList(function(data) {
							var popup_html = $(self.getTemplate({
									name: 'callflowEdit',
									data: {
										items: _.sortBy(data, 'name'),
										selected: node.getMetadata('id') || ''
									},
									submodule: 'qubicle'
								})),
								popup;

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
								node.setMetadata('id', $('#queue_selector', popup_html).val());

								node.caption = $('#queue_selector option:selected', popup_html).text();

								popup.dialog('close');
							});

							popup = monster.ui.dialog(popup_html, {
								title: self.i18n.active().callflows.qubicle.qubicle,
								minHeight: '0',
								beforeClose: function() {
									if (typeof callback === 'function') {
										callback();
									}
								}
							});
						});
					}
				}
			}

			$.extend(callflow_nodes, actions);

		},

		qubicleList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'qubicleQueues.list',
				data: {
					accountId: self.accountId,
					filters: { paginate: false }
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
