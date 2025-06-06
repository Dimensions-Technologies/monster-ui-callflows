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
						blacklistForm = template.find('#blacklist-form'),
						$listNumbers = template.find('.saved-numbers');

					monster.ui.validate(blacklistForm, {
						rules: {
							'name': { required: true }
						}
					});

					_.each(data.numbers, function(v, number) {
						$listNumbers.append($(self.getTemplate({
							name: 'addNumber',
							data: {
								number: number,
								miscSettings: miscSettings
							},
							submodule: 'blacklist'
						})));
					});

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

		/*
		blacklistBindEvents: function(data, template, callbacks) {
			var self = this,
				addNumber = function(e) {
					var number = template.find('#number_value').val();

					if (number) {
						$('.list-numbers .saved-numbers', template)
							.prepend($(self.getTemplate({
								name: 'addNumber',
								data: {
									number: number
								},
								submodule: 'blacklist'
							})));

						$('#number_value', template).val('');
					}
				};

			$('.number-wrapper.placeholder:not(.active)', template).on('click', function() {
				var $this = $(this);

				$this.addClass('active');

				$('#number_value', template).focus();
			});

			$('#add_number', template).on('click', function(e) {
				e.preventDefault();
				addNumber(e);
			});

			$('.add-number', template).bind('keypress', function(e) {
				var code = e.keyCode || e.which;

				if (code === 13) {
					addNumber(e);
				}
			});

			$(template).delegate('.delete-number', 'click', function(e) {
				$(this).parents('.number-wrapper').remove();
			});

			$('#cancel_number', template).on('click', function(e) {
				e.stopPropagation();

				$('.number-wrapper.placeholder.active', template).removeClass('active');
				$('#number_value', template).val('');
			});

			$('.blacklist-save', template).on('click', function() {
				var formData = form2object('blacklist-form'),
					cleanData = self.blacklistCleanFormData(formData),
					mapNumbers = {};

				$('.saved-numbers .number-wrapper', template).each(function(k, wrapper) {
					var number = $(wrapper).attr('data-number');
					mapNumbers[number] = {};
				});

				cleanData.numbers = mapNumbers;

				if (data.id) {
					cleanData.id = data.id;
				}

				self.blacklistSave(cleanData, callbacks.save_success);
			});

			$('.blacklist-delete', template).on('click', function() {
				monster.ui.confirm(self.i18n.active().callflows.blacklist.are_you_sure_you_want_to_delete, function() {
					self.blacklistDelete(data.id, callbacks.delete_success);
				});
			});
		},
		*/

		blacklistBindEvents: function(data, template, callbacks) {
			var self = this,
				addNumber = function(e) {
					var number = template.find('#number_value').val();

					if (number) {
						$('.list-numbers .saved-numbers', template)
							.prepend($(self.getTemplate({
								name: 'addNumber',
								data: {
									number: number,
									miscSettings: miscSettings
								},
								submodule: 'blacklist'
							})));

						$('#number_value', template).val('');
					}
				};

			$('*[rel=popover]:not([type="text"])', template).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', template).popover({
				trigger: 'focus'
			});

			$('.number-wrapper.placeholder:not(.active)', template).click(function() {
				var $this = $(this);

				$this.addClass('active');

				$('#number_value', template).focus();
			});

			$('#add_number', template).click(function(e) {
				e.preventDefault();
				addNumber();
			});

			$('.add-number', template).bind('keypress', function(e) {
				var code = e.keyCode || e.which;

				if (code === 13) {
					addNumber(e);
				}
			});

			$(template).delegate('.delete-number, .material-symbols-icon-blocklist-delete', 'click', function(e) {
				$(this).parents('.number-wrapper').remove();
			});

			$('#cancel_number', template).click(function(e) {
				e.stopPropagation();

				$('.number-wrapper.placeholder.active', template).removeClass('active');
				$('#number_value', template).val('');
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

				$('.saved-numbers .number-wrapper', template).each(function(k, wrapper) {
					var number = $(wrapper).attr('data-number');
					mapNumbers[number] = {};
				});

				cleanData.numbers = mapNumbers;

				if (data.id) {
					cleanData.id = data.id;
				}

				self.blacklistSave(cleanData, callbacks.save_success);

			};

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
