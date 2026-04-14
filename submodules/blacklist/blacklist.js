define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		hideAdd = false,
		miscSettings = {};

	var app = {
		requests: {},

		subscribe: {
			'callflows.blacklist.edit': 'blacklistEdit',
			'callflows.fetchActions': 'blacklistDefineActions',
			'callflows.blacklist.submoduleButtons': 'blacklistSubmoduleButtons'
		},

		blacklistDefineActions: function(args) {
			var self = this,
				callflow_nodes = args.actions;

			// set variables for use elsewhere
			hideAdd = args.hideAdd;
			miscSettings = args.miscSettings;

			$.extend(callflow_nodes, {
				'blacklist': {
					name: self.i18n.active().callflows.blacklist.title,
					module: 'blacklist',
					listEntities: function(callback) {
						self.callApi({
							resource: 'blacklist.list',
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
					editEntity: 'callflows.blacklist.edit'
				}
			});
		},

		// Added for the subscribed event to avoid refactoring conferenceEdit
		blacklistEdit: function(args) {
			var self = this,
				afterGetData = function(data) {
					var template = $(self.getTemplate({
							name: 'edit',
							data: {
								data: data,
								hideAdd: hideAdd,
								miscSettings: miscSettings
							},
							submodule: 'blacklist'
						})),
						blacklistForm = template.find('#blacklist-form');

					monster.ui.validate(blacklistForm, {
						rules: {
							'name': { required: true }
						}
					});

					var $numbersEditorSection = template.find('#blacklist_numbers_editor_section');

					var listEditorHtml = $(self.getTemplate({
						name: 'listEditor',
						data: {
							title: self.i18n.active().callflows.blacklist.listNumbers,
							addLabel: self.i18n.active().callflows.blacklist.addNumber,
							placeholder: 'Phone Number'
						}
					}));

					$numbersEditorSection.empty().append(listEditorHtml);

					// convert blacklist { numbers: { "<num>": {} } } into an array
					var initialNumbers = [];
					if (data && data.numbers && typeof data.numbers === 'object') {
						initialNumbers = Object.keys(data.numbers).reverse();
					}

					var numbersEditor = self.listEditorBind({
						container: listEditorHtml,
						initial: initialNumbers,
						valueType: 'phoneNumber',
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
							return (v || '').toString().trim();
						},
						invalidMessage: self.i18n.active().callflows.blacklist.invalid_number
					});

					data._numbersEditor = numbersEditor;

					self.blacklistBindEvents(data, template, args.callbacks);

					(args.target)
						.empty()
						.append(template);
				};

			if (miscSettings.callflowButtonsWithinHeader) {
				self.blacklistSubmoduleButtons(args);
			};

			if (args.data.id) {
				self.blacklistGet(args.data.id, function(data) {
					afterGetData(data);
				});
			} else {
				afterGetData({});
			}
		},

		blacklistBindEvents: function(data, template, callbacks) {
			var self = this;

			$('.list-editor-error', template).hide();
				
			$('*[rel=popover]:not([type="text"])', template).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', template).popover({
				trigger: 'focus'
			});

			$('.blacklist-save', template).click(function() {
				saveButtonEvents();
			});

			$('#submodule-buttons-container .save').click(function() {
				saveButtonEvents();
			});

			function saveButtonEvents() {
				var formData = monster.ui.getFormData('blacklist-form'),
					cleanData = self.blacklistCleanFormData(formData),
					mapNumbers = {};

				var editor = data._numbersEditor;
				
				var numbers = (editor && typeof editor.getValues === 'function')
					? editor.getValues()
					: [];

				_.each(numbers, function(number) {
					mapNumbers[number] = {};
				});

				cleanData.numbers = mapNumbers;

				if (data.id) {
					cleanData.id = data.id;
				}

				self.blacklistSave(cleanData, callbacks.save_success);
			}

			$('.blacklist-delete', template).click(function() {
				deleteButtonEvents();
			});

			$('#submodule-buttons-container .delete').click(function() {
				deleteButtonEvents();
			});

			function deleteButtonEvents() {

				monster.ui.confirm(self.i18n.active().callflows.blacklist.are_you_sure_you_want_to_delete, function() {
					self.blacklistDelete(data.id, callbacks.delete_success);
				});

			};

		},

		blacklistCleanFormData: function(data) {
			delete data.extra;

			return data;
		},

		blacklistSave: function(data, callback) {
			var self = this;

			if (data.id) {
				self.blacklistUpdate(data, callback);
			} else {
				self.blacklistCreate(data, callback);
			}
		},

		blacklistList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.list',
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

		blacklistGet: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.get',
				data: {
					accountId: self.accountId,
					blacklistId: id
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		blacklistCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		blacklistUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.update',
				data: {
					accountId: self.accountId,
					blacklistId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		blacklistDelete: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'blacklist.delete',
				data: {
					accountId: self.accountId,
					blacklistId: id
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		blacklistSubmoduleButtons: function(data) {
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
						hideDelete: hideAdd.blacklist
					}
				}));
			
			$('.entity-header-buttons').empty();
			$('.entity-header-buttons').append(buttons);

			if (!data.data.id) {
				$('.delete', '.entity-header-buttons').addClass('disabled');
			}
		}
	};

	return app;
});
