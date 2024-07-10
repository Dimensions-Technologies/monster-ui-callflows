define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		isReseller = false,
		uk999Enabled = false,
		hideFromMenu = {},
		hideAdd = {},
		hideCallflowAction = {},
		hideFromCallflowAction = {},
		hideClassifiers = {},
		miscSettings = {},
		hideDeviceTypes = {},
		ttsLanguages = {},
		selectedItemId = null,
		deviceAudioCodecs = {},
		deviceVideoCodecs = {};

	var appSubmodules = [
		'blacklist',
		'branchvariable',
		'conference',
		'device',
		'directory',
		'faxbox',
		'featurecodes',
		'groups',
		'media',
		'menu',
		'misc',
		'qubicle',
		'resource',
		'temporalset',
		'timeofday',
		'user',
		'vmbox'
	];

	require(_.map(appSubmodules, function(name) {
		return './submodules/' + name + '/' + name;
	}));

	var app = {
		name: 'dt-callflows',

		css: [ 'app', 'icons' ],

		i18n: {
			'de-DE': { customCss: false },
			'en-US': { customCss: false }
		},

		// Defines API requests not included in the SDK
		requests: {
			'presence.update': {
				url: 'accounts/{accountId}/presence/{presenceId}',
				verb: 'POST'
			}
		},

		// Define the events available for other apps
		subscribe: {},

		subModules: appSubmodules,

		appFlags: {
			flow: {},

			// For now we use that to only load the numbers classifiers the first time we load the app, since it is very unlikely to change often
			appData: {},

			showAllCallflows: (monster.config.hasOwnProperty('developerFlags') && monster.config.developerFlags.showAllCallflows) || monster.apps.auth.originalAccount.superduper_admin
		},

		actions: {},
		categories: {},
		flow: {},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		load: function(callback) {
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		initApp: function(callback) {
			var self = this;

			/* Used to init the auth token and account id of self app */
			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		// Entry Point of the app
		render: function(container) {
			var self = this,
				parent = _.isEmpty(container) ? $('#monster_content') : container;

			// check if the account logged in with is a reseller account
			if (monster.util.isReseller()) {
				isReseller = true
			}

			// check whitelable doc for dimension configuration for app
			if (monster.config.whitelabel.hasOwnProperty('dimension')) {

				var data;
				data = monster.config.whitelabel;
				
				if (data.dimension.hasOwnProperty('dt_callflows')) {

					if (data.dimension.dt_callflows.hasOwnProperty('hideFromMenu')) {
																						
						data.dimension.dt_callflows.hideFromMenu.forEach(function(action) {
							hideFromMenu[action] = true;
						});							

					}

					if (data.dimension.dt_callflows.hasOwnProperty('hideAdd')) {
																						
						data.dimension.dt_callflows.hideAdd.forEach(function(action) {
							hideAdd[action] = true;
						});							

					}

					if (data.dimension.dt_callflows.hasOwnProperty('hideCallflowAction')) {
																						
						data.dimension.dt_callflows.hideCallflowAction.forEach(function(action) {
							hideCallflowAction[action] = true;
						});							

					}

					if (data.dimension.dt_callflows.hasOwnProperty('hideFromCallflowAction')) {
						Object.keys(data.dimension.dt_callflows.hideFromCallflowAction).forEach(function(key) {
							data.dimension.dt_callflows.hideFromCallflowAction[key].forEach(function(action) {
								if (!hideFromCallflowAction.hasOwnProperty(key)) {
									hideFromCallflowAction[key] = {};
								}
								hideFromCallflowAction[key][action] = true;
							});
						});
					}

					if (data.dimension.dt_callflows.hasOwnProperty('hideClassifiers')) {
																						
						data.dimension.dt_callflows.hideClassifiers.forEach(function(action) {
							hideClassifiers[action] = true;
						});							

					}

					if (data.dimension.dt_callflows.hasOwnProperty('miscSettings')) {
																						
						data.dimension.dt_callflows.miscSettings.forEach(function(action) {
							miscSettings[action] = true;
						});							

					}

					if (data.dimension.dt_callflows.hasOwnProperty('hideDeviceTypes')) {
																						
						data.dimension.dt_callflows.hideDeviceTypes.forEach(function(action) {
							hideDeviceTypes[action] = true;
						});							

					}

					if (data.dimension.dt_callflows.hasOwnProperty('ttsLanguages')) {
										
						ttsLanguages = data.dimension.dt_callflows.ttsLanguages

					}

					if (data.dimension.dt_callflows.hasOwnProperty('deviceAudioCodecs')) {
										
						deviceAudioCodecs = data.dimension.dt_callflows.deviceAudioCodecs

					}

					if (data.dimension.dt_callflows.hasOwnProperty('deviceVideoCodecs')) {
										
						deviceVideoCodecs = data.dimension.dt_callflows.deviceVideoCodecs

					}

				}

			}

			// set miscSettings.hideCallRestictions based on account type if not explicitly set
			if (miscSettings.hideCallRestictions == undefined) {

				if (isReseller == true) {
					miscSettings.hideCallRestictions = false
				} 

				else {
					miscSettings.hideCallRestictions = true
				}
			
			}

			// log to console if enabled
			if (miscSettings.enableConsoleLogging == true || false) {
				console.log('hideFromMenu:', hideFromMenu);
				console.log('hideAdd:', hideAdd);
				console.log('hideCallflowAction:', hideCallflowAction);
				console.log('hideFromCallflowAction:', hideFromCallflowAction);
				console.log('hideClassifiers:', hideClassifiers);
				console.log('miscSettings:', miscSettings);
				console.log('hideDeviceTypes:', hideDeviceTypes);
				console.log('ttsLanguages:', ttsLanguages);
				console.log('deviceAudioCodecs:', deviceAudioCodecs);
				console.log('deviceVideoCodecs:', deviceVideoCodecs);
			}

			monster.pub('callflows.fetchActions', { actions: self.actions, hideAdd, hideCallflowAction, hideFromCallflowAction, hideClassifiers, miscSettings, hideDeviceTypes, ttsLanguages, deviceAudioCodecs, deviceVideoCodecs });
			self.renderEntityManager(parent);

			// show warning message if emergency caller id has not been set on the account
			if (miscSettings.checkEmergencyNumber == true || false) {

				self.callApi({
					resource: 'account.get',
					data: {
						accountId: self.accountId
					},
					success: function(data) {


						// check if 'uk_999_enabled' exists and is true on account doc
						if (data.data.hasOwnProperty('dimension')) {
							uk999Enabled = (data.data.dimension.hasOwnProperty('uk_999_enabled') && data.data.dimension.uk_999_enabled == true) ? true : false;	
						} 
						
						else {
							uk999Enabled = false;
						}

						// check if emergency caller id has been set on the account
						if (data.data.hasOwnProperty('caller_id') && data.data.caller_id.hasOwnProperty('emergency') && data.data.caller_id.emergency.hasOwnProperty('number')) {
							
							
							if (miscSettings.checkEmergencyAddress999 == true || false) {

								if (uk999Enabled == true) {
									self.callApi({
										resource: 'numbers.get',
										data: {
											accountId: self.accountId,
											phoneNumber: data.data.caller_id.emergency.number
										},
										success: function(data) {
											if (!data.data.hasOwnProperty('dimension') || !data.data.dimension.hasOwnProperty('uk_999')) {
												monster.ui.alert('warning', self.i18n.active().callflows.uk999.emergencyCallerIdAddressNotSet);												
											}
										}
									});
								}

							}

							if (miscSettings.checkEmergencyAddress911 == true || false) {

								self.callApi({
									resource: 'numbers.get',
									data: {
										accountId: self.accountId,
										phoneNumber: data.data.caller_id.emergency.number
									},
									success: function(data) {
										if (!data.data.hasOwnProperty('e911')) {
											monster.ui.alert('warning', self.i18n.active().callflows.uk999.emergencyCallerIdAddressNotSet);
										}
									}
								});

							}

						}

						else {

							// emergency caller id has not been set on the account
							monster.ui.alert('warning', self.i18n.active().callflows.uk999.emergencyCallerIdNotSet);
						
						}
					}
				});

			}

		},

		renderCallflows: function(container) {

			var self = this,
				callflowsTemplate = $(self.getTemplate({
					name: 'callflow-manager',
					data: {
						miscSettings: miscSettings,
						canToggleCallflows: (monster.config.hasOwnProperty('developerFlags') && monster.config.developerFlags.showAllCallflows) || monster.apps.auth.originalAccount.superduper_admin,
						hasAllCallflows: self.appFlags.showAllCallflows
					}
				}));

			self.bindCallflowsEvents(callflowsTemplate, container);

			monster.ui.tooltips(callflowsTemplate);

			self.repaintList({
				template: callflowsTemplate,
				callback: function() {
					(container)
						.empty()
						.append(callflowsTemplate);

					container.find('.search-query').focus();

					self.hackResize(callflowsTemplate);
				}
			});
		},

		bindCallflowsEvents: function(template, container) {
			var self = this,
				callflowList = template.find('.list-container .list'),
				isLoading = false,
				loader = $('<li class="content-centered list-loader"> <i class="fa fa-spinner fa-spin"></i></li>'),
				searchLink = $(self.getTemplate({
					name: 'callflowList-searchLink'
				}));

			template.find('.superadmin-mode #switch_role').on('change', function(e) {
				self.appFlags.showAllCallflows = $(this).is(':checked');

				self.renderCallflows(container);
			});

			// Add Callflow
			template.find('.list-add').on('click', function() {
				template.find('.callflow-content')
					.removeClass('listing-mode')
					.addClass('edition-mode');
				
				if (miscSettings.enableSelectedElementColor == true || false) {
					$('.list-element').removeClass('selected-element');
				}

				self.editCallflow();
			});

			// Edit Callflow
			callflowList.on('click', '.list-element', function() {
				var $this = $(this),
					callflowId = $this.data('id');

				if (miscSettings.enableSelectedElementColor == true || false) {
					$('.list-element').removeClass('selected-element');
					$this.addClass('selected-element');
				}

				template.find('.callflow-content')
					.removeClass('listing-mode')
					.addClass('edition-mode');

				self.editCallflow({ id: callflowId });
			});

			callflowList.on('scroll', function() {
				if (!isLoading && callflowList.data('next-key') && (callflowList.scrollTop() >= (callflowList[0].scrollHeight - callflowList.innerHeight() - 100))) {
					isLoading = true;
					callflowList.append(loader);

					self.listData({
						callback: function(callflowData) {
							var listCallflows = $(self.getTemplate({
								name: 'callflowList',
								data: {
									callflows: callflowData.data
								}
							}));

							loader.remove();

							callflowList
								.append(listCallflows)
								.data('next-key', callflowData.next_start_key || null);

							isLoading = false;
						},
						nextStartKey: callflowList.data('next-key'),
						searchValue: callflowList.data('search-value')
					});
				}
			});

			// Search list
			template.find('.search-query').on('keyup', function() {
				var search = $(this).val();

				searchLink.find('.search-value').text(search);
				if (search) {
					$.each(template.find('.list-element'), function() {
						var $elem = $(this);
						if ($elem.data('search').toLowerCase().indexOf(search.toLowerCase()) >= 0) {
							$elem.show();
						} else {
							$elem.hide();
						}
					});
					if (miscSettings.paginateListCallflows) {
						callflowList.prepend(searchLink);
					}
				} else {
					template.find('.list-element').show();
					if (miscSettings.paginateListCallflows) {
						searchLink.remove();
					}
				}
				
			});

			callflowList.on('click', '.search-link', function() {
				if (searchLink.hasClass('active')) {
					callflowList.data('search-value', null);
					searchLink
						.removeClass('active')
						.remove();
					template
						.find('.search-query')
						.prop('disabled', false)
						.val('');
					self.repaintList({ template: template });
				} else {
					var searchValue = searchLink.find('.search-value').text();
					searchLink
						.addClass('active')
						.remove();
					callflowList.data('search-value', searchValue);

					template.find('.search-query').prop('disabled', true);

					self.repaintList({
						template: template,
						searchValue: searchValue,
						callback: function() {
							callflowList.prepend(searchLink);
						}
					});
				}
			});
		},

		renderEntityManager: function(container) {

			var hideFromMenuAccountSettings = false,
				hideFromMenuFeatureCodes = false;
			
			if (hideFromMenu.hasOwnProperty('account_settings') && hideFromMenu.account_settings === true) {
				hideFromMenuAccountSettings = true;
			}

			if (hideFromMenu.hasOwnProperty('feature_codes') && hideFromMenu.feature_codes === true) {
				hideFromMenuFeatureCodes = true;
			}
			
			var self = this,
				entityActions = _
					.chain(self.actions)
					.filter('listEntities')
					.keyBy('module')
					.value(),
				template = $(self.getTemplate({
					name: 'layout',
					data: {
						actions: _
							.chain(entityActions)
							.map(function(action) {
								// add the hideFromMenu property conditionally
								action.hideFromMenu = self.shouldHideAction(action.module);
								return action;
							})
							.sortBy('name')
							.value(),
							hideFromMenuAccountSettings: hideFromMenuAccountSettings,
							hideFromMenuFeatureCodes: hideFromMenuFeatureCodes,
							miscSettings: miscSettings,
							entityName: 'User'
					}
				}));

			self.bindEntityManagerEvents({
				parent: container,
				template: template,
				actions: entityActions
			});

			container
				.empty()
				.append(template);
		},

		// method to determine if an menu item should be hidden
		shouldHideAction: function(module) {
			if (hideFromMenu.hasOwnProperty(module) && hideFromMenu[module] === true) {
				return true;
			}
			return false;
		},		

		bindEntityManagerEvents: function(args) {
			var self = this,
				template = args.template,
				actions = args.actions,
				editEntity = function(type, id) {
					monster.pub(actions[type].editEntity, {
						data: id ? { id: id } : {},
						parent: template,
						target: template.find('.entity-edition .entity-content'),
						callbacks: {
							after_render: function() {
								$(window).trigger('resize');
								template.find('.entity-edition .callflow-content').animate({ scrollTop: 0 });
							},
							save_success: function(data) {
								self.refreshEntityList({
									template: template,
									actions: actions,
									entityType: type,
									data: data
								});
								editEntity(type, data.id);
							},
							delete_success: function(data) {
								self.refreshEntityList({
									template: template,
									actions: actions,
									entityType: type
								});
								template.find('.entity-edition .entity-content').empty();
							}
						}
					});
				};

			self.hackResize(template.find('.entity-edition'));

			template.find('.entity-manager .entity-element').on('click', function() {
				var $this = $(this);
				if ($this.hasClass('callflow-element')) {
					self.renderCallflows(template.find('.callflow-edition'));

					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				} else if ($this.hasClass('account-element')) {
					self.renderAccountSettings(template.find('.callflow-edition'));

					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				} else if ($this.hasClass('feature-code-element')) {
					monster.pub('callflows.featurecode.render', {
						target: template.find('.callflow-edition'),
						data: {
							miscSettings: miscSettings
						}
					});
					
					template.find('.callflow-app-section').hide();
					template.find('.callflow-edition').show();
				} else {
					var entityType = $this.data('type');
						
					if (hideAdd.hasOwnProperty(entityType) && hideAdd[entityType] === true) {	

						template.find('.list-add').hide();
						
						if (miscSettings.embeddedListView) {
							
							var entityName = actions[entityType].name;
							function removePluralSuffix(name) {
								// Check if name ends with 's' or 'es' and remove them
								return name.replace(/(s|es)$/i, '');
							}
							entityName = removePluralSuffix(entityName);
							//$('.monster-button.list-add .entity-name-placeholder').text(entityName);
							$('.entity-name-placeholder').text(entityName);

						} else {
							template.find('.entity-edition .entity-header .entity-title').text(actions[entityType].name);
						}

						self.refreshEntityList({
							template: template,
							actions: actions,
							entityType: entityType
						});

					}

					else {

						template.find('.list-add').show();
						
						if (miscSettings.embeddedListView) {
							
							var entityName = actions[entityType].name;
							function removePluralSuffix(name) {
								// Check if name ends with 's' or 'es' and remove them
								return name.replace(/(s|es)$/i, '');
							}
							entityName = removePluralSuffix(entityName);
							//$('.monster-button.list-add .entity-name-placeholder').text(entityName);
							$('.entity-name-placeholder').text(entityName);
							

						} else {
							template.find('.entity-edition .entity-header .entity-title').text(actions[entityType].name);
						}

						self.refreshEntityList({
							template: template,
							actions: actions,
							entityType: entityType
						});

					}
					
				}
			});

			template.on('click', '.entity-header .back-button', function() {
				template.find('.entity-edition .entity-content').empty();
				template.find('.entity-edition .list-container .list').empty();
				template.find('.entity-edition .search-query').val('');
				template.find('.callflow-edition').empty();

				template.find('.callflow-app-section').hide();
				template.find('.entity-manager').show();
			});

			template.find('.entity-edition .list-add').on('click', function() {
				var type = template.find('.entity-edition .list-container .list').data('type');
				editEntity(type);

				if (miscSettings.enableSelectedElementColor == true || false) {
					$('.list-element').removeClass('selected-element');
				};

				/*
				if (miscSettings.callflowButtonsWithinHeader) {
					console.log('callflows.'+type+'.submoduleButtons')
					monster.pub('callflows.' + type + '.submoduleButtons')
				};
				*/

			});

			template.find('.entity-edition .list-container .list').on('click', '.list-element', function() {
				var $this = $(this),
					id = $this.data('id'),
					type = $this.parents('.list').data('type');

				if (miscSettings.enableSelectedElementColor == true || false) {
					$('.list-element').removeClass('selected-element');
					$this.addClass('selected-element');
				}

				editEntity(type, id);
			});

			template.find('.entity-edition .search-query').on('keyup', function() {
				var search = $(this).val();
				if (search) {
					$.each(template.find('.entity-edition .list-element'), function() {
						var $elem = $(this);
						if ($elem.data('search').toLowerCase().indexOf(search.toLowerCase()) >= 0) {
							$elem.show();
						} else {
							$elem.hide();
						}
					});
				} else {
					template.find('.entity-edition .list-element').show();
				}
			});
		},

		refreshEntityList: function(args) {
			var self = this,
				getLowerCasedDisplayName = _.flow(
					_.partial(_.get, _, 'displayName'),
					_.toLower
				),
				template = args.template,
				actions = args.actions,
				entityType = args.entityType,
				callback = args.callbacks,
				data = args.data,
				formatEntityData = _.bind(self.formatEntityData, self, _, entityType);

			actions[entityType].listEntities(function(entities) {
				var listEntities = $(self.getTemplate({
					name: 'entity-list',
					data: {
						entities: _
							.chain(entities)
							.thru(formatEntityData)
							.sortBy(getLowerCasedDisplayName)
							.value()
					}
				}));

				monster.ui.tooltips(listEntities);

				template.find('.entity-edition .list-container .list')
					.empty()
					.append(listEntities)
					.data('type', entityType);

				template.find('.callflow-app-section').hide();
				template.find('.entity-edition').show();
				template.find('.search-query').focus();

				$(window).trigger('resize');
				
				if (miscSettings.callflowButtonsWithinHeader && data == null) {
					$('.entity-header-buttons').empty();
				}

				if (miscSettings.enableSelectedElementColor && data != null) {
					$('.list-element[data-id="' + data.id + '"]').addClass('selected-element');
				}

				callback && callback();
			});
		},

		formatEntityData: function(entities, entityType) {
			var self = this,
				isStringAndNotEmpty = _.overEvery(
					_.isString,
					_.negate(_.isEmpty)
				),
				getFullName = function(entity) {
					var values = _.map([
							'first_name',
							'last_name'
						], _.partial(_.ary(_.get, 2), entity)),
						hasInvalidValue = _.some(values, _.negate(isStringAndNotEmpty));

					return hasInvalidValue ? undefined : _.join(values, ' ');
				},
				getDisplayName = function(entity) {
					return _
						.chain([
							getFullName(entity),
							_.map([
								'name',
								'id'
							], _.partial(_.ary(_.get, 2), entity))
						])
						.flatten()
						.find(isStringAndNotEmpty)
						.value();
				},
				isMediaSource = function(entity) {
					return entityType === 'play' && entity.media_source;
				},
				isUser = function(entity) {
					if (miscSettings.userListShowExtension) {
						return entityType === 'user' && entity.presence_id;
					}
				};;

			return _.map(entities, function(entity) {
				return _.merge({
					displayName: getDisplayName(entity)
				}, isMediaSource(entity) && {
					additionalInfo: self.i18n.active().callflows.media.mediaSources[entity.media_source]
				}, isUser(entity) && {
					additionalInfo: entity.presence_id
				}, entity);
			});
		},

		renderAccountSettings: function(container) {
			var self = this;
		
			self.list_classifiers(function(error, classifiersData) {
				if (error) {
					console.error('Error fetching classifiers:', error);
					return;
				}
		
				self.loadAccountSettingsData(function(accountSettingsData) {
					
					var currentRestrictions = {};
					
					// Get current account call restictions
					if (accountSettingsData.account.hasOwnProperty('call_restriction')) {
						currentRestrictions = accountSettingsData.account.call_restriction;
					}

					var formattedData = self.formatAccountSettingsData(accountSettingsData);
		
					// Set account call restictions for the ui
					formattedData.classifiers = Object.keys(classifiersData).map(key => ({
						id: key,
						name: classifiersData[key].friendly_name,
						action: currentRestrictions[key] && currentRestrictions[key].action === 'deny' ? 'deny' : 'inherit'
					}));

					var template = $(self.getTemplate({
						name: 'accountSettings',
						data: {
							...formattedData,
							miscSettings: miscSettings
						}
					}));
		
					var widgetBlacklist = self.renderBlacklists(template, accountSettingsData);
					var allowAddingExternalCallerId = !miscSettings.preventAddingExternalCallerId;
		
					_.forEach(monster.util.getCapability('caller_id.external_numbers').isEnabled ? [
						'external',
						'emergency',
						'asserted'
					] : [], function(type) {
						var $target = template.find('.caller-id-' + type + '-target');
		
						if (!$target.length) {
							return;
						}
						monster.ui.cidNumberSelector($target, {
							allowAdd: allowAddingExternalCallerId,
							noneLabel: self.i18n.active().callflows.accountSettings.callerId.defaultNumber,
							selectName: 'caller_id.' + type + '.number',
							selected: _.get(formattedData.account, ['caller_id', type, 'number']),
							cidNumbers: formattedData.externalNumbers,
							phoneNumbers: _.map(formattedData.numberList, function(number) {
								return {
									number: number
								};
							})
						});
					});
		
					monster.ui.tooltips(template);
		
					// Setup input fields
					monster.ui.chosen(template.find('.cid-number-select, .preflow-callflows-dropdown'));
					monster.ui.mask(template.find('.phone-number'), 'phoneNumber');
		
					// Set validation rules
					monster.ui.validate(template.find('#account_settings_form'), {
						rules: {
							'caller_id.asserted.number': {
								phoneNumber: true
							},
							'caller_id.asserted.realm': {
								realm: true
							}
						},
						messages: {
							'caller_id.asserted.number': self.i18n.active().callflows.accountSettings.callerId.messages.invalidNumber
						}
					});
		
					container.empty().append(template);
		
					self.bindAccountSettingsEvents(template, accountSettingsData, widgetBlacklist);
				});
			});
		},
		


		formatAccountSettingsData: function(data) {
			var silenceMedia = 'silence_stream://300000',
				isShoutcast = _
					.chain(data.account)
					.get('music_on_hold.media_id')
					.thru(_.overEvery(
						_.partial(_.includes, _, '://'),
						_.partial(_.negate(_.isEqual), silenceMedia)
					))
					.value(),
				preflowCallflows = _
					.chain(data.callflows)
					.filter(_.overEvery(
						{ featurecode: false },
						_.flow(
							_.partial(_.get, _, 'numbers'),
							_.partial(_.negate(_.includes), _, 'no_match')
						)
					))
					.map(function(callflow) {
						return _.merge({
							friendlyName: _.get(callflow, 'name', _.toString(callflow.numbers))
						}, _.pick(callflow, [
							'id'
						]));
					})
					.sortBy(_.flow(
						_.partial(_.get, _, 'friendlyName'),
						_.toLower
					))
					.value(),
				hasExternalCallerId = monster.util.getCapability('caller_id.external_numbers').isEnabled;

			return _.merge({
				hasExternalCallerId: hasExternalCallerId,
				numberList: _.keys(data.numberList),
				extra: {
					isShoutcast: isShoutcast,
					preflowCallflows: preflowCallflows
				},
				outbound_flags: _
					.chain(data.outbound_flags)
					.pick([
						'dynamic',
						'static'
					])
					.mapValues(
						_.partial(_.ary(_.join, 2), _, ',')
					)
					.value(),
				silenceMedia: silenceMedia
			}, _.pick(monster.config.whitelabel, [
				'showMediaUploadDisclosure',
				'showPAssertedIdentity'
			]), _.omit(data, [
				'numberList',
				'callflows'
			]));
		},

		renderBlacklists: function(template, accountSettingsData) {
			var self = this,
				items = [],
				selectedBlacklists = [];

			_.each(accountSettingsData.blacklists, function(blacklist) {
				items.push({
					key: blacklist.id,
					value: blacklist.name
				});
			});
			selectedBlacklists = _.filter(items, function(bl) {
				return (accountSettingsData.account.blacklists || []).indexOf(bl.key) >= 0;
			});

			// we return it so we can use the getSelectedItems() method later
			return monster.ui.linkedColumns(template.find('.blacklists-wrapper'), items, selectedBlacklists);
		},

		bindAccountSettingsEvents: function(template, data, widgetBlacklist) {
			var self = this,
				// account = args.account,
				mediaToUpload,
				closeUploadDiv = function(newMedia) {
					mediaToUpload = undefined;
					template.find('.upload-div input').val('');
					template.find('.upload-div').slideUp(function() {
						template.find('.upload-toggle').removeClass('active');
					});
					if (newMedia) {
						var mediaSelect = template.find('.media-dropdown');
						mediaSelect.append('<option value="' + newMedia.id + '">' + newMedia.name + '</option>');
						mediaSelect.val(newMedia.id);
					}
				};

			template.find('.account-settings-tabs a').click(function(e) {
				e.preventDefault();

				$(this).tab('show');
			});

			template.find('.media-dropdown').on('change', function() {
				template.find('.shoutcast-div').toggleClass('active', $(this).val() === 'shoutcast').find('input').val('');
			});

			if (miscSettings.readOnlyCallerIdName == true || false) {
				template.find('.caller-id-external-number').on('change', function() {
					phoneNumber = $('.caller-id-external-number select[name="caller_id.external.number"]').val();
					formattedNumber = phoneNumber.replace(/^\+44/, '0');
					$('#caller_id_external_name', template).val(formattedNumber);				
				});
			}

			if (miscSettings.readOnlyCallerIdName == true || false) {
				template.find('.caller-id-emergency-number').on('change', function() {
					phoneNumber = $('.caller-id-emergency-number select[name="caller_id.emergency.number"]').val();
					formattedNumber = phoneNumber.replace(/^\+44/, '0');
					$('#caller_id_emergency_name', template).val(formattedNumber);
				});
			}

			if (miscSettings.readOnlyCallerIdName == true || false) {
				template.find('.caller-id-asserted-number').on('change', function() {
					phoneNumber = $('.caller-id-asserted-number select[name="caller_id.asserted.number"]').val();
					formattedNumber = phoneNumber.replace(/^\+44/, '0');
					$('#caller_id_asserted_name', template).val(formattedNumber);
				});
			}

			template.find('.upload-input').fileUpload({
				inputOnly: true,
				wrapperClass: 'file-upload input-append',
				btnText: self.i18n.active().callflows.accountSettings.musicOnHold.audioUploadButton,
				btnClass: 'monster-button',
				maxSize: 5,
				success: function(results) {
					mediaToUpload = results[0];
				},
				error: function(errors) {
					if (errors.hasOwnProperty('size') && errors.size.length > 0) {
						monster.ui.alert(self.i18n.active().callflows.accountSettings.musicOnHold.fileTooBigAlert);
					}
					template.find('.upload-div input').val('');
					mediaToUpload = undefined;
				}
			});

			template.find('.upload-toggle').on('click', function() {
				if ($(this).hasClass('active')) {
					template.find('.upload-div').stop(true, true).slideUp();
				} else {
					template.find('.upload-div').stop(true, true).slideDown();
				}
			});

			template.find('.upload-cancel').on('click', function() {
				closeUploadDiv();
			});

			template.find('.upload-submit').on('click', function() {
				template.find('.shoutcast-div').removeClass('active');
				if (mediaToUpload) {
					self.callApi({
						resource: 'media.create',
						data: {
							accountId: self.accountId,
							data: {
								streamable: true,
								name: mediaToUpload.name,
								media_source: 'upload',
								description: mediaToUpload.name
							}
						},
						success: function(data, status) {
							var media = data.data;
							self.callApi({
								resource: 'media.upload',
								data: {
									accountId: self.accountId,
									mediaId: media.id,
									data: mediaToUpload.file
								},
								success: function(data, status) {
									closeUploadDiv(media);
								},
								error: function(data, status) {
									self.callApi({
										resource: 'media.delete',
										data: {
											accountId: self.accountId,
											mediaId: media.id,
											data: {}
										},
										success: function(data, status) {}
									});
								}
							});
						}
					});
				} else {
					monster.ui.alert(self.i18n.active().callflows.accountSettings.musicOnHold.emptyUploadAlert);
				}
			});

			template.find('.account-settings-update').on('click', function() {
				// Validate form
				if (!monster.ui.valid(template.find('#account_settings_form'))) {
					return;
				}

				// Collect data
				var formData = monster.ui.getFormData('account_settings_form'),
					newData = _.merge({}, data.account, formData);

				// Format data
				if (_.has(newData.caller_id, 'asserted')) {
					newData.caller_id.asserted.number = monster.util.getFormatPhoneNumber(newData.caller_id.asserted.number).e164Number;
				}

				// Clean empty data
				if (formData.music_on_hold.media_id === '') {
					delete newData.music_on_hold.media_id;
				} else if (formData.music_on_hold.media_id === 'shoutcast') {
					newData.music_on_hold.media_id = template.find('.shoutcast-url-input').val();
				}

				self.compactObject(newData.caller_id);

				if (_.isEmpty(newData.caller_id)) {
					delete newData.caller_id;
				}

				if (!miscSettings.hidePreflow) {
					if (formData.preflow.always === '_disabled') {
						delete newData.preflow.always;
					}
				}

				// Get call restriction data if account is reseller and call restrictions are not being hidden
				if (isReseller == true && (miscSettings.hideCallRestictions != true || false)) {
					formData.call_restriction;
				}

				if (!miscSettings.hideOutboundFlags) {
					if (newData.hasOwnProperty('outbound_flags')) {
						newData.outbound_flags.dynamic = newData.outbound_flags.dynamic ? newData.outbound_flags.dynamic.split(',') : [];
						newData.outbound_flags.static = newData.outbound_flags.static ? newData.outbound_flags.static.split(',') : [];
						_.isEmpty(newData.outbound_flags.dynamic) && delete newData.outbound_flags.dynamic;
						_.isEmpty(newData.outbound_flags.static) && delete newData.outbound_flags.static;
						_.isEmpty(newData.outbound_flags) && delete newData.outbound_flags;
					}
				}

				newData.blacklists = widgetBlacklist.getSelectedItems();

				delete newData.extra;

				self.callApi({
					resource: 'account.update',
					data: {
						accountId: newData.id,
						data: newData
					},
					success: function(data, status) {
						self.render();

						/* added toaster for future use
						monster.ui.toast({
							type: 'success',
							message: self.i18n.active().entityManager.changesSaved,
							options: {
								positionClass: 'toast-bottom-right',
								timeOut: 3000,
								extendedTimeOut: 1000,
							}
						});
						*/

					}
				});
			});
		},

		loadAccountSettingsData: function(callback) {
			var self = this;
			monster.parallel(_.merge({
				account: function(parallelCallback) {
					self.callApi({
						resource: 'account.get',
						data: {
							accountId: self.accountId
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				callflows: function(parallelCallback) {
					self.callApi({
						resource: 'callflow.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				mediaList: function(parallelCallback) {
					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				},
				numberList: function(parallelCallback) {
					self.callApi({
						resource: 'numbers.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data.numbers);
						}
					});
				},
				blacklists: function(parallelCallback) {
					self.callApi({
						resource: 'blacklist.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: false
							}
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data);
						}
					});
				}
			}, monster.util.getCapability('caller_id.external_numbers').isEnabled && {
				externalNumbers: function(next) {
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
				}
			}), function(err, results) {
				callback && callback(results);
			});
		},

		hackResize: function(container) {
			var self = this;

			// Adjusting the layout divs height to always fit the window's size
			$(window).resize(function(e) {
				var $listContainer = container.find('.list-container'),
					$mainContent = container.find('.callflow-content'),
					$tools = container.find('.tools'),
					$flowChart = container.find('.flowchart'),
					contentHeight = window.innerHeight - $('.core-topbar-wrapper').outerHeight(),
					contentHeightPx = contentHeight + 'px',
					innerContentHeightPx = (contentHeight - 71) + 'px';

				$listContainer.css('height', window.innerHeight - $listContainer.position().top + 'px');
				$mainContent.css('height', contentHeightPx);
				$tools.css('height', innerContentHeightPx);
				$flowChart.css('height', innerContentHeightPx);
			});
			$(window).resize();
		},

		repaintList: function(args) {
			var self = this,
				args = args || {},
				template = args.template || $('#callflow_container'),
				callback = args.callback;

			self.listData({
				callback: function(callflowData) {
					var listCallflows = $(self.getTemplate({
						name: 'callflowList',
						data: { callflows: callflowData.data }
					}));

					template.find('.list-container .list')
						.empty()
						.append(listCallflows)
						.data('next-key', callflowData.next_start_key || null);
	
					if (miscSettings.enableSelectedElementColor == true || false) {
						$('.list-element[data-id="' + selectedItemId + '"]').addClass('selected-element');
					}

					callback && callback(callflowData.data);
				},
				searchValue: args.searchValue
			});
		},

		listData: function(args) {
			var self = this,
				nextStartKey = args.nextStartKey,
				searchValue = args.searchValue,
				callback = args.callback,
				apiResource = searchValue ? 'callflow.searchByNameAndNumber' : 'callflow.list',
				apiData = _.merge({
					accountId: self.accountId
				}, nextStartKey && {
					filters: {
						start_key: nextStartKey
					}
				}, !self.appFlags.showAllCallflows && {
					filters: {
						paginate: miscSettings.paginateListCallflows || false,
						filter_not_numbers: 'no_match',
						'filter_not_ui_metadata.origin': [
							'voip',
							'callqueues',
							'callqueues-pro',
							'csv-onboarding'
						]
					}
				}, searchValue && {
					value: searchValue 
				});

			self.callApi({
				resource: apiResource,
				data: apiData,
				success: function(callflowData) {
					var returnedCallflowData = self.formatData(callflowData);

					callback && callback(returnedCallflowData);
				}
			});
		},

		listNumbers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(numbers) {
					numbers = self.formatListSpareNumbers(numbers.data.numbers);

					callback && callback(numbers);
				}
			});
		},

		formatListSpareNumbers: function(numbers) {
			var self = this,
				listSpareNumbers = [];

			_.each(numbers, function(numberData, phoneNumber) {
				if (!numberData.hasOwnProperty('used_by') || numberData.used_by === '') {
					numberData.phoneNumber = phoneNumber;
					listSpareNumbers.push(numberData);
				}
			});

			return listSpareNumbers;
		},

		formatData: function(data) {
			var formattedList = [];

			_.each(data.data, function(callflow) {
				var formattedNumbers = _.map(callflow.numbers || '-', function(number) {
						return _.startsWith('+', number)
							? monster.util.formatPhoneNumber(number)
							: number;
					}),
					listNumbers = formattedNumbers.toString(),
					isFeatureCode = callflow.featurecode !== false && !_.isEmpty(callflow.featurecode);

				if (!isFeatureCode) {
					if (callflow.name) {
						callflow.description = listNumbers;
						callflow.title = callflow.name;
					} else {
						callflow.title = listNumbers;
					}

					formattedList.push(callflow);
				}
			});

			formattedList.sort(function(a, b) {
				return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
			});

			data.data = formattedList;

			return data;
		},

		editCallflow: function(data) {
			var self = this,
				existingCallflow = false;

			delete self.original_flow; // clear original_flow

			$('#callflow-view .callflow_help').hide();

			self.resetFlow();

			if (data && data.id) {
				existingCallflow = true;
				self.callApi({
					resource: 'callflow.get',
					data: {
						accountId: self.accountId,
						callflowId: data.id
					},
					success: function(callflow) {
						var callflow = callflow.data;

						//self.resetFlow();
						self.dataCallflow = callflow;

						self.flow.id = callflow.id;
						self.flow.name = callflow.name;
						self.flow.contact_list = { exclude: 'contact_list' in callflow ? callflow.contact_list.exclude || false : false };
						self.flow.caption_map = callflow.metadata;

						if (callflow.flow.module !== undefined) {
							self.flow.root = self.buildFlow(callflow.flow, self.flow.root, 0, '_');
						}

						self.flow.numbers = callflow.numbers || [];

						self.repaintFlow();
					}
				});
			} else {
				self.resetFlow();
				self.dataCallflow = {};
				self.repaintFlow();
			}

			self.renderButtons(existingCallflow);
			self.renderTools();

			if (!data) {
				if (miscSettings.callflowButtonsWithinHeader) {
					$('.delete', '.entity-header').addClass('disabled');
					$('.duplicate', '.entity-header').addClass('disabled');
				} else {
					$('.delete', '#ws_callflow').addClass('disabled');
					$('.duplicate', '#ws_callflow').addClass('disabled');
				}
			}

		},

		renderButtons: function(existingCallflow) {
			var self = this,
				buttons = $(self.getTemplate({
					name: 'buttons',
					data: {
						miscSettings: miscSettings,
						existingCallflow: existingCallflow
					}
				}));

			$('.buttons').empty();

			$('.save', buttons).click(function() {

				if (self.flow.numbers && self.flow.numbers.length > 0) {
					self.save();
				} else {
					monster.ui.alert(self.i18n.active().oldCallflows.invalid_number + '<br/><br/>' + self.i18n.active().oldCallflows.please_select_valid_number);
				}
			});

			$('.delete', buttons).click(function() {

				if (self.flow.id) {
					monster.ui.confirm(self.i18n.active().oldCallflows.are_you_sure, function() {
						self.callApi({
							resource: 'callflow.delete',
							data: {
								accountId: self.accountId,
								callflowId: self.flow.id
							},
							success: function() {
								$('#ws_cf_flow').empty();
								$('.buttons').empty();
								$('#ws_cf_tools').empty();
								$('#hidden_callflow_warning').hide();

								self.repaintList();
								self.resetFlow();
							}
						});

						self.show_pending_change(false);
					});
				} else {
					monster.ui.alert(self.i18n.active().oldCallflows.this_callflow_has_not_been_created);
				}
			});

			// copy callflow
			$('.duplicate', buttons).click(function() {

				if (miscSettings.enableSelectedElementColor == true || false) {
					$('.list-element').removeClass('selected-element');
				}

				delete(self.dataCallflow.id);
				delete(self.dataCallflow.numbers);

				self.flow.name = self.flow.name + ' (Copy)';
				self.flow.id = undefined;
				self.flow.numbers = [];

				// repaint buttons 
				var existingCallflow = false;
				self.renderButtons(existingCallflow);

                self.repaintFlow();

				monster.ui.alert(self.i18n.active().oldCallflows.duplicate_callflow_info);
				
				$('#pending_change', '#ws_callflow').show();
				if (miscSettings.callflowButtonsWithinHeader) {
					$('.delete', '.entity-header').addClass('disabled');
					$('.duplicate', '.entity-header').addClass('disabled');
					if (!miscSettings.disableButtonAnimation) {
						$('.save', '.entity-header').addClass('pulse-box');
					}
				} else {
					$('.delete', '#ws_callflow').addClass('disabled');
					$('.duplicate', '#ws_callflow').addClass('disabled');
					if (!miscSettings.disableButtonAnimation) {
						$('.save', '#ws_callflow').addClass('pulse-box');
					}
				}
                
            });

			$('.buttons').append(buttons);
		},

		// Callflow JS code
		buildFlow: function(json, parent, id, key) {
			var self = this,
				branch = self.branch(self.construct_action(json));

			branch.data.data = _.get(json, 'data', {});
			branch.id = ++id;
			branch.key = key;
			branch.disabled = _.get(json, 'data.skip_module');

			branch.caption = self.actions.hasOwnProperty(branch.actionName) ? self.actions[branch.actionName].caption(branch, self.flow.caption_map) : '';

			if (self.actions.hasOwnProperty(parent.actionName) && self.actions[parent.actionName].hasOwnProperty('key_caption')) {
				branch.key_caption = self.actions[parent.actionName].key_caption(branch, self.flow.caption_map);
			}

			if (json.hasOwnProperty('children')) {
				$.each(json.children, function(key, child) {
					branch = self.buildFlow(child, branch, id, key);
				});
			}

			parent.addChild(branch);

			return parent;
		},

		construct_action: function(json) {
			var self = this,
				actionParams = '';

			if ('data' in json) {
				if ('id' in json.data) {
					actionParams = 'id=*,';
				}

				if ('action' in json.data) {
					actionParams += 'action=' + json.data.action + ',';
				}
			}

			if (actionParams !== '') {
				actionParams = '[' + actionParams.replace(/,$/, ']');
			} else {
				actionParams = '[]';
			}

			return _.has(self.actions, json.module + actionParams)
				? json.module + actionParams
				: json.module + '[]';
		},

		resetFlow: function() {
			var self = this;

			self.flow = {};
			self.flow.root = self.branch('root'); // head of the flow tree
			self.flow.root.key = 'flow';
			self.flow.numbers = [];
			self.flow.caption_map = {};
			self.formatFlow();	
		},

		formatFlow: function() {
			var self = this;

			self.flow.root.index(0);
			self.flow.nodes = self.flow.root.nodes();
		},

		// Create a new branch node for the flow
		branch: function(actionName) {
			var self = this;

			function Branch(actionName) {
				var that = this,
					action = self.actions[actionName] || {};

				this.id = -1;
				this.actionName = actionName;
				this.module = action.module;
				this.key = '_';
				this.parent = null;
				this.children = [];
				this.data = {
					data: $.extend(true, {}, action.data)
				};
				this.caption = '';
				this.key_caption = '';

				this.potentialChildren = function() {
					var list = [];

					for (var i in self.actions) {
						if (self.actions[i].isUsable) {
							list[i] = i;
						}
					}

					for (var i in action.rules) {
						var rule = action.rules[i];

						if (rule.type === 'quantity' && this.children.length >= rule.maxSize) {
							list = [];
						}
					}

					return list;
				};

				this.allowedChildren = function() {
					
					var children;

					for (var i in action.rules) {
						var rule = action.rules[i];

						if (rule.type === 'allowedChildren') {
							var children = rule.action;
						}
					}

					return children;
				};

				this.terminatingAction = function() {
				
					var actionName = Object(action).key;
					var isTerminating = action.isTerminating;

					return {
						actionName: actionName,
						isTerminating: isTerminating
					}
				};

				this.contains = function(branch) {
					var toCheck = branch;

					while (toCheck.parent) {
						if (this.id === toCheck.id) {
							return true;
						} else {
							toCheck = toCheck.parent;
						}
					}

					return false;
				};

				this.removeChild = function(branch) {
					$.each(this.children, function(i, child) {
						if (child.id === branch.id) {
							that.children.splice(i, 1);
							return false;
						}
					});
				};

				this.addChild = function(branch, position) {
					if (!(branch.actionName in this.potentialChildren())) {
						return false;
					}
				
					if (branch.contains(this)) {
						return false;
					}
				
					if (branch.parent) {
						branch.parent.removeChild(branch);
					}
				
					branch.parent = this;
				
					// Insert the new branch at the specified position or at the end if position is not provided
					if (typeof position === 'number' && position >= 0 && position < this.children.length) {
						this.children.splice(position, 0, branch);
					} else {
						this.children.push(branch);
					}
				
					return true;
				};

				this.getMetadata = function(key, defaultValue) {
					var value;

					if (_.has(this.data, ['data', key])) {
						value = this.data.data[key];

						return (value === 'null') ? null : value;
					}

					return _.isUndefined(defaultValue) ? false : defaultValue;
				};

				this.setMetadata = function(key, value) {
					if (!('data' in this.data)) {
						this.data.data = {};
					}

					this.data.data[key] = (value == null) ? 'null' : value;
				};

				this.deleteMetadata = function(key) {
					if ('data' in this.data && key in this.data.data) {
						delete this.data.data[key];
					}
				};

				this.index = function(index) {
					this.id = index;

					$.each(this.children, function() {
						index = this.index(index + 1);
					});

					return index;
				};

				this.nodes = function() {
					var nodes = {};

					nodes[this.id] = this;

					$.each(this.children, function() {
						var buf = this.nodes();

						$.each(buf, function() {
							nodes[this.id] = this;
						});
					});

					return nodes;
				};

				this.serialize = function() {
					var json = $.extend(true, {}, this.data);

					json.module = this.module;

					json.children = {};

					$.each(this.children, function() {
						json.children[this.key] = this.serialize();
					});

					return json;
				};
			}

			return new Branch(actionName);
		},

		repaintFlow: function() {
			var self = this;

			// Let it there for now, if we need to save callflows automatically again.
			/*if ('savable' in THIS.flow) {
				THIS.save_callflow_no_loading();
			}*/

			self.flow.savable = true;

			var target = $('#ws_cf_flow').empty();

			target.append(this.getUIFlow());

			var current_flow = self.stringify_flow(self.flow);

			if (!('original_flow' in self) || self.original_flow.split('|')[0] !== current_flow.split('|')[0]) {
				self.original_flow = current_flow;
				self.show_pending_change(false);
			} else {
				self.show_pending_change(self.original_flow !== current_flow);
			}

			var metadata = self.dataCallflow.hasOwnProperty('ui_metadata') ? self.dataCallflow.ui_metadata : false,
				isHiddenCallflow = metadata && metadata.hasOwnProperty('origin') && _.includes(['voip', 'migration', 'mobile', 'callqueues'], metadata.origin);

			isHiddenCallflow ? $('#hidden_callflow_warning').show() : $('#hidden_callflow_warning').hide();
		},

		show_pending_change: function(pending_change) {
			var self = this;
			if (pending_change) {
				$('#pending_change', '#ws_callflow').show();
				$('.duplicate', '#ws_callflow').addClass('disabled');
				if (miscSettings.callflowButtonsWithinHeader) {
					if (!miscSettings.disableButtonAnimation) {
						$('.save', '.entity-header').addClass('pulse-box');
					}
				} else {
					if (!miscSettings.disableButtonAnimation) {
						$('.save', '#ws_callflow').addClass('pulse-box');
					}
				}
			} else {
				$('#pending_change', '#ws_callflow').hide();
				$('.duplicate', '#ws_callflow').removeClass('disabled');
				if (!miscSettings.disableButtonAnimation) {
					$('.save', '#ws_callflow').removeClass('pulse-box');
				}
			}
		},

		// We add this function because today the stringify flow doesn't handle arrays well
		// For instance in ring groups, if we change the timeout of a member, it won't toggle the "pending changes" warning
		stringify_obj: function(obj) {
			var self = this,
				str = '[';

			_.each(obj, function(v, k) {
				// Had to add this check since when we list objects with sortable, we usually just add items with .data(), but it includes sortableItem from the jQuery plugin for a short time.
				// If we don't avoid it, then we run into a JS Exception
				if (k !== 'sortableItem') {
					if (typeof v === 'object') {
						str += k + ':' + self.stringify_obj(v);
					} else if (['boolean', 'string', 'number'].indexOf(typeof v) >= 0) {
						str += k + ':' + v;
					}

					str += '|';
				}
			});

			str += ']';

			return str;
		},

		stringify_flow: function(flow) {
			var self = this,
				s_flow = flow.id + '|' + (!flow.name ? 'undefined' : flow.name),
				first_iteration;
			s_flow += '|NUMBERS';
			$.each(flow.numbers, function(key, value) {
				s_flow += '|' + value;
			});
			s_flow += '|NODES';
			$.each(flow.nodes, function(key, value) {
				s_flow += '|' + key + '::';
				first_iteration = true;

				$.each(value.data.data, function(k, v) {
					if (!first_iteration) {
						s_flow += '//';
					} else {
						first_iteration = false;
					}

					if (typeof v !== 'object') {
						s_flow += k + ':' + v;
					} else {
						s_flow += k + ':' + self.stringify_obj(v);
					}
				});
			});

			return s_flow;
		},

		getCallflowPreview: function(data, callback) {
			var self = this,
				layout;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: data.id
				},
				success: function(callflow) {
					var callflow = callflow.data,
						flow = {};

					flow.root = self.branch('root');
					flow.root.key = 'flow';
					flow.numbers = [];
					flow.caption_map = {};
					flow.root.index(0);
					flow.nodes = flow.root.nodes();

					flow.id = callflow.id;
					flow.name = callflow.name;
					flow.contact_list = { exclude: 'contact_list' in callflow ? callflow.contact_list.exclude || false : false };
					flow.caption_map = callflow.metadata;

					if (callflow.flow.module !== undefined) {
						flow.root = self.buildFlow(callflow.flow, flow.root, 0, '_');
					}

					flow.nodes = flow.root.nodes();
					flow.numbers = callflow.numbers || [];

					//prepare html from callflow

					layout = self.renderBranch(flow.root);
					callback && callback(layout);

					$('.node', layout).each(function() {
						var node = flow.nodes[$(this).attr('id')],
							$node = $(this),
							node_html;

						if (node.actionName === 'root') {
							$node.removeClass('icons_black root');
							node_html = $(self.getTemplate({
								name: 'root',
								data: {
									name: flow.name || 'Callflow'
								}
							}));

							for (var counter, size = flow.numbers.length, j = Math.floor((size) / 2) + 1, i = 0; i < j; i++) {
								counter = i * 2;

								var numbers = flow.numbers.slice(counter, (counter + 2 < size) ? counter + 2 : size),
									row = $(self.getTemplate({
										name: 'rowNumber',
										data: {
											numbers: numbers
										}
									}));

								node_html
									.find('.content')
									.append(row);
							}
						} else {
							node_html = $(self.getTemplate({
								name: 'node',
								data: {
									node: node,
									callflow: self.actions[node.actionName]
								}
							}));
						}
						$(this).append(node_html);
					});
				}
			});
		},

		getUIFlow: function() {
			var self = this;

			self.formatFlow();

			var layout = self.renderBranch(self.flow.root);

			$('.node', layout).hover(function() {
				$(this).addClass('over');
			}, function() {
				$(this).removeClass('over');
			});

			$('.node', layout).each(function() {
				var node = self.flow.nodes[$(this).attr('id')],
					$node = $(this),
					node_html;

				if (node.actionName === 'root') {
					$node.removeClass('icons_black root');
					node_html = $(self.getTemplate({
						name: 'root',
						data: {
							name: self.flow.name || 'Callflow'
						}
					}));

					$('.edit_icon', node_html).click(function() {
						self.flow = $.extend(true, { contact_list: { exclude: false } }, self.flow);

						var dialogTemplate = $(self.getTemplate({
								name: 'editName',
								data: {
									miscSettings: miscSettings,
									name: self.flow.name,
									exclude: self.flow.contact_list.exclude,
									ui_is_main_number_cf: self.dataCallflow.hasOwnProperty('ui_is_main_number_cf') ? self.dataCallflow.ui_is_main_number_cf : false
								}
							})),
							popup = monster.ui.dialog(dialogTemplate, {
								title: self.i18n.active().oldCallflows.popup_title
							});

						$('#add', popup).click(function() {
							var $callflow_name = $('#callflow_name', popup);
							if ($callflow_name.val() !== '') {
								self.flow.name = $callflow_name.val();
								$('.root .top_bar .name', layout).html(self.flow.name);
							} else {
								self.flow.name = '';
								$('.root .top_bar .name', layout).html('Callflow');
							}
							self.flow.contact_list = {
								exclude: $('#callflow_exclude', popup).prop('checked')
							};
							self.dataCallflow.ui_is_main_number_cf = $('#ui_is_main_number_cf', popup).prop('checked');
							//self.save_callflow_no_loading();
							self.repaintFlow();
							popup.dialog('close');
						});
					});

					for (var counter, size = self.flow.numbers.length, j = Math.floor((size) / 2) + 1, i = 0; i < j; i++) {
						counter = i * 2;

						var numbers = self.flow.numbers.slice(counter, (counter + 2 < size) ? counter + 2 : size),
							row = $(self.getTemplate({
								name: 'rowNumber',
								data: {
									numbers: _.map(numbers, function(number) {
										return _.startsWith('+', number)
											? monster.util.formatPhoneNumber(number)
											: number;
									})
								}
							}));

						node_html
							.find('.content')
							.append(row);
					}

					$('.number_column.empty', node_html).click(function() {
						self.listNumbers(function(phoneNumbers) {
							var parsedNumbers = [];

							_.each(phoneNumbers, function(number) {
								if ($.inArray(number.phoneNumber, self.flow.numbers) < 0) {
									parsedNumbers.push(number);
								}
							});

							var popup_html = $(self.getTemplate({
									name: 'addNumber',
									data: {
										phoneNumbers: parsedNumbers,
										hideBuyNumbers: _.get(monster, 'config.whitelabel.hideBuyNumbers', false)
									}
								})),
								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().oldCallflows.add_number
								});

							monster.ui.chosen(popup_html.find('#list_numbers'), {
								width: '160px'
							});
							// Have to do that so that the chosen dropdown isn't hidden.
							popup_html.parent().css('overflow', 'visible');

							if (parsedNumbers.length === 0) {
								$('#list_numbers', popup_html).attr('disabled', 'disabled');
								$('<option value="select_none">' + self.i18n.active().oldCallflows.no_phone_numbers + '</option>').appendTo($('#list_numbers', popup_html));
							}

							var refresh_numbers = function() {
								self.listNumbers(function(refreshedNumbers) {
									$('#list_numbers', popup).empty();

									if (refreshedNumbers.length === 0) {
										$('#list_numbers', popup).attr('disabled', 'disabled');
										$('<option value="select_none">' + self.i18n.active().oldCallflows.no_phone_numbers + '</option>').appendTo($('#list_numbers', popup));
									} else {
										$('#list_numbers', popup).removeAttr('disabled');
										$.each(refreshedNumbers, function(k, v) {
											$('<option value="' + v + '">' + v + '</option>').appendTo($('#list_numbers', popup));
										});
									}
								});
							};

							$('.extensions_content', popup).hide();

							$('input[name="number_type"]', popup).click(function() {
								if ($(this).val() === 'your_numbers') {
									$('.list_numbers_content', popup).show();
									$('.extensions_content', popup).hide();
								} else {
									$('.extensions_content', popup).show();
									$('.list_numbers_content', popup).hide();
								}
							});

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

							popup.find('.search-extension-link').on('click', function() {
								monster.pub('common.extensionTools.select', {
									callback: function(number) {
										popup.find('#add_number_text').val(number);
									}
								});
							});

							$('.add_number', popup).click(function(event) {
								event.preventDefault();
								var number = $('input[name="number_type"]:checked', popup).val() === 'your_numbers' ? $('#list_numbers option:selected', popup).val() : $('#add_number_text', popup).val();

								if (number !== 'select_none' && number !== '') {
									self.flow.numbers.push(number);
									popup.dialog('close');

									self.repaintFlow();
								} else {
									monster.ui.alert(self.i18n.active().oldCallflows.you_didnt_select);
								}
							});
						});
					});

					$('.number_column .delete', node_html).click(function() {
						var number = $(this).parent('.number_column').data('number') + '',
							index = $.inArray(number, self.flow.numbers);

						if (index >= 0) {
							self.flow.numbers.splice(index, 1);
						}

						self.repaintFlow();
					});
				} else {
					node_html = $(self.getTemplate({
						name: 'node',
						data: {
							node: node,
							callflow: self.actions[node.actionName]
						}
					}));

					// If an API request takes some time, the user can try to re-click on the element, we do not want to let that re-fire a request to the back-end.
					// So we set a 500ms debounce wait that will prevent any other interaction with the callflow element.
					node_html.find('.module').on('click', _.debounce(function() {
						monster.waterfall([
							function(waterfallCallback) {
								if (node.disabled) {
									monster.ui.confirm(self.i18n.active().callflowsApp.editor.confirmDialog.enableModule.text,
										function() {
											waterfallCallback(null, false);
										},
										function() {
											waterfallCallback(null, true);
										}, {
											cancelButtonText: self.i18n.active().callflowsApp.editor.confirmDialog.enableModule.cancel,
											confirmButtonText: self.i18n.active().callflowsApp.editor.confirmDialog.enableModule.ok
										});
								} else {
									waterfallCallback(null, null);
								}
							}
						], function(err, disabled) {
							if (!_.isNull(disabled)) {
								node.disabled = disabled;
								if (_.has(node, 'data.data.skip_module')) {
									node.data.data.skip_module = disabled;
								}

								if (!disabled) {
									node_html.closest('.node').removeClass('disabled');
								}
							}

							self.actions[node.actionName].edit(node, function() {
								self.repaintFlow();
							});
						});
					}, 500, {
						leading: true,
						trailing: false
					}));
				}

				// make names of callflow nodes clickable
				$('.details a', node_html).click(function(event) {
					event.stopPropagation();
					var previewCallflowId = self.flow.nodes[$(node_html).find('.delete').attr('id')].data.data.id,
						dialogTemplate = $(self.getTemplate({
							name: 'callflows-callflowElementDetails',
							data: {
								id: previewCallflowId
							}
						})),
						popup;
					self.getCallflowPreview({ id: previewCallflowId }, function(callflowPreview) {
						popup = monster.ui.dialog(dialogTemplate, {
							position: ['top', 20], // put preview near top of screen to have lots of space for it
							title: self.i18n.active().oldCallflows.callflow_preview_title,
							width: '650px'
						});
						popup.find('.callflow-preview-section.callflow').append(callflowPreview);
						$('#callflow_jump').click(function() {
							self.editCallflow({ id: previewCallflowId });
							popup.dialog('close').remove();
						});
					});
				});

				$(this).append(node_html);

				$(this).droppable({
					drop: function(event, ui) {
						var targetId = $(this).attr('id'),
							target = self.flow.nodes[targetId],
							action,
							branch,
							validActionNames = [
								'menu[id=*]', 
								'branch_variable[]', 
								'temporal_route[]'
							];
						
						/* // commented out as don't believe latter section not required
						function addChildBelow(parent, node, position) {
							if (parent) {
								// add the node below the target at the specified position
								parent.addChild(node, position);
							} else {
								// if the target has no parent, add the node as a sibling
								self.flow.nodes[node.id] = node;
								self.flow.root = node;
							}
						}
						*/
						
						function addChildBelow(parent, node, position) {
							// add the node below the target at the specified position
							parent.addChild(node, position);
							
						}
						
						// action is a new item being added to the callflow
						if (ui.draggable.hasClass('action')) {
							action = ui.draggable.attr('name');
							branch = self.branch(action);
							branch.caption = self.actions[action].caption(branch, self.flow.caption_map);
				
							// handle callflow actions that support parallel children
							if (validActionNames.includes(target.actionName)) {
							
								addChildBelow(target, branch);

							} else {

								// check if callflow actions that support parallel children
								if (validActionNames.includes(action)) {
									
									// store the children of the target temporarily
									var originalChildren = target.children.slice();

									// handle new callflow with no children
									if (originalChildren.length == 0) {
							
										addChildBelow(target, branch);

									}

									else {

										var parentKey = '_';
										var parentKeyCaption = 'Default action'

										// update child branch key value
										originalChildren[0].key = parentKey;
										originalChildren[0].key_caption = parentKeyCaption;
						
										// remove the children from the target
										target.children = [];
						
										// add the new branch below the target
										addChildBelow(target, branch, originalChildren.length + 1);
						
										// re-add the original children as children of the new branch
										originalChildren.forEach(function(child) {
											branch.addChild(child);
										});

									}
									
								}

								else {

									// store the children of the target temporarily
									var originalChildren = target.children.slice();
					
									// remove the children from the target
									target.children = [];
					
									// add the new branch below the target
									addChildBelow(target, branch, originalChildren.length + 1);
					
									// re-add the original children as children of the new branch
									originalChildren.forEach(function(child) {
										branch.addChild(child);
									});

								}
								
							}
				
							if (branch.parent && ('key_caption' in self.actions[branch.parent.actionName])) {
								branch.key_caption = self.actions[branch.parent.actionName].key_caption(branch, self.flow.caption_map);
				
								self.actions[branch.parent.actionName].key_edit(branch, function() {
									self.actions[action].edit(branch, function() {
										// repaint the flow after all operations are completed
										self.repaintFlow();
									});
								});
							} else {
								self.actions[action].edit(branch, function() {
									// repaint the flow after all operations are completed
									self.repaintFlow();
								});
							}
						}
				
						// node is an action already on the callflow
						if (ui.draggable.hasClass('node')) {
							
							// handle callflow actions that support parallel children
							if (validActionNames.includes(target.actionName)) {
							
								var branch = self.flow.nodes[ui.draggable.attr('id')];

								if (target.addChild(branch)) {

									// if we move a node, destroy its key
									
									branch.key = '_';
	
									if (branch.parent && ('key_caption' in self.actions[branch.parent.actionName])) {

										branch.key_caption = self.actions[branch.parent.actionName].key_caption(branch, self.flow.caption_map);
									
									}
									
									ui.draggable.remove();
									self.repaintFlow();

								}					

							} else {

								var draggedNodeId = ui.draggable.attr('id');
								var draggedNode = self.flow.nodes[draggedNodeId];
					
								// Store the children of the target temporarily
								var originalChildren = target.children.slice();
					
								// Remove the children from the target
								target.children = [];
					
								// Add the dragged node below the target
								addChildBelow(target, draggedNode);
					
								// Re-add the original children as children of the dragged node
								originalChildren.forEach(function(child) {
									draggedNode.addChild(child);
								});
					
								if (draggedNode.parent && ('key_caption' in self.actions[draggedNode.parent.actionName])) {
									draggedNode.key_caption = self.actions[draggedNode.parent.actionName].key_caption(draggedNode, self.flow.caption_map);
								}
					
								// Repaint the flow after all operations are completed
								self.repaintFlow();

							}	
						}
					}
				});
				
				// dragging the whole branch
				if ($(this).attr('name') !== 'root') {
					$(this).draggable({
						start: function() {
							var children = $(this).next(),
								top = children.offset().top - $(this).offset().top,
								left = children.offset().left - $(this).offset().left;

							self.enableDestinations($(this));

							$(this).attr('t', top); $(this).attr('l', left);
						},
						drag: function() {
							var children = $(this).next(),
								top = $(this).offset().top + parseInt($(this).attr('t')),
								left = $(this).offset().left + parseInt($(this).attr('l'));

							children.offset({ top: top, left: left });
						},
						stop: function() {
							self.disableDestinations();

							self.repaintFlow();
						}
					});
				}
			});		

			// delete a callflow action
			$('.node-options .delete', layout).click(function() {

				var validActionNames = [
					'menu[id=*]', 
					'branch_variable[]', 
					'temporal_route[]'
				];
				var nodeId = $(this).attr('id');
				var node = self.flow.nodes[nodeId];

				// handle callflow actions that support parallel children
				if (validActionNames.includes(node.actionName)) {

					monster.ui.confirm(self.i18n.active().oldCallflows.delete_callflow_action_confirm + '<br>' + self.i18n.active().oldCallflows.delete_callflow_action_note_1, function() { 

						if (node.parent) {
							node.parent.removeChild(node);

							self.repaintFlow();

						}
					
					});

				}

				else {

					if (node.parent) {

						monster.ui.confirm(self.i18n.active().oldCallflows.delete_callflow_action_confirm + '<br>' + self.i18n.active().oldCallflows.delete_callflow_action_note_2, function() {
							var parentNode = node.parent;
							var parentKey = node.key;
							var parentKeyCaption = node.key_caption;
												
							// store the index of the node in its parent's children array
							var nodeIndex = parentNode.children.indexOf(node);
					
							// remove the node from its parent
							parentNode.removeChild(node);
					
							// move the children of the deleted node to the position of the deleted node
							for (var i = node.children.length - 1; i >= 0; i--) {
								var childNode = node.children[i];
								parentNode.children.splice(nodeIndex, 0, node.children[i]);

								// set the parent properties of the child node
								childNode.parent = parentNode;
								childNode.key = parentKey;
								childNode.key_caption = parentKeyCaption;

							}
					
							// repaint the flow after all operations are completed
							self.repaintFlow();

						});

					}

				}


			});		

			return layout;

		},

		renderBranch: function(branch) {
			var self = this,
				flow = $(self.getTemplate({
					name: 'branch',
					data: {
						node: branch,
						display_key: branch.parent && ('key_caption' in self.actions[branch.parent.actionName])
					}
				})),
				children;

			if (branch.parent && ('key_edit' in self.actions[branch.parent.actionName])) {
				$('.div_option', flow).click(function() {
					self.actions[branch.parent.actionName].key_edit(branch, function() {
						self.repaintFlow();
					});
				});
			}

			// This need to be evaluated before the children start adding content
			children = $('.children', flow);

			$.each(branch.children, function() {
				children.append(self.renderBranch(this));
			});

			return flow;
		},

		renderTools: function() {
			var self = this,
				advanced_cat = self.i18n.active().oldCallflows.advanced_cat,
				basic_cat = self.i18n.active().oldCallflows.basic_cat,
				dataTemplate = { categories: [] },
				categories = {},
				target,
				tools;

			categories[basic_cat] = [];
			categories[advanced_cat] = [];

			$.each(self.actions, function(i, data) {
				if ('category' in data && (!data.hasOwnProperty('isListed') || data.isListed)) {
					_.set(categories, data.category, _.get(categories, data.category, []));
					data.key = i;
					categories[data.category].push(data);
				}
			});

			$.each(categories, function(key, val) {
				if (key !== basic_cat && key !== advanced_cat) {
					dataTemplate.categories.push({ key: key, actions: val });
				}
			});

			dataTemplate.categories.sort(function(a, b) {
				return a.key < b.key ? 1 : -1;
			});

			dataTemplate.categories.unshift({
				key: basic_cat,
				actions: categories[basic_cat]
			}, {
				key: advanced_cat,
				actions: categories[advanced_cat]
			});

			$.each(categories, function(idx, val) {
				val.sort(function(a, b) {
					if (a.hasOwnProperty('weight')) {
						return a.weight > b.weight ? 1 : -1;
					}
				});
			});

			tools = $(self.getTemplate({
				name: 'tools',
				data: dataTemplate
			}));

			// set the basic drawer to open
			$('#Basic', tools).removeClass('inactive').addClass('active');

			$('.category .open', tools).click(function() {
				tools
					.find('.category')
					.removeClass('active')
					.addClass('inactive');

				$(this)
					.parent('.category')
					.removeClass('inactive')
					.addClass('active');
			});

			var help_box = $('.callflow_helpbox_wrapper', '#callflow-view').first(),
				$allActions = tools.find('.tool');

			tools.find('.search-query').on('keyup', function() {
				// debounce executes a function after a delay if it hasn't been called again
				_.debounce(function(arg) {
					var $this = arg,
						val = $this.val().toLowerCase(),
						categories = [];

					if (val) {
						tools.find('.category').removeClass('active').addClass('inactive');

						$allActions.each(function() {
							var $thisAction = $(this);

							if ($thisAction.data('name').toLowerCase().indexOf(val) >= 0) {
								$thisAction.show();
								categories.push($thisAction.parents('.category').attr('id'));
							} else {
								$thisAction.hide();
							}
						});
					} else {
						tools.find('.category').removeClass('active').addClass('inactive');
						tools.find('.category').first().removeClass('inactive').addClass('active');
						tools.find('.tool').show();
					}

					categories = _.uniq(categories);
					_.each(categories, function(category) {
						tools.find('.category[name="' + category + '"]').addClass('active').removeClass('inactive');
					});
				}, 200)($(this));
			});

			$('.tool', tools).hover(
				function() {
					var $this = $(this);
					if ($this.attr('help')) {
						tools.find('.callflow_helpbox_wrapper #help_box').html($this.attr('help'));
						tools.find('.callflow_helpbox_wrapper').css('top', $this.offset().top).css('left', $('#ws_cf_tools').offset().left - 162).show();
					}
				},
				function() {
					tools.find('.callflow_helpbox_wrapper').hide();
				}
			);

			function action(el) {
				el.draggable({
					start: function() {
						self.enableDestinations($(this));
						$(this).addClass('inactive');
					},
					drag: function() {
						$('.callflow_helpbox_wrapper', '#callflow-view').hide();
					},
					stop: function() {
						self.disableDestinations();
						$(this).removeClass('inactive');
					},
					containment: $('body'),
					helper: 'clone'
				});
			}

			$('.action', tools).each(function() {
				action($(this));
			});

			target = $('#ws_cf_tools').empty();
			target.append(tools);

			$('#ws_cf_tools', '#callflow-view').disableSelection();
		},

		enableDestinations: function(el) {
			
			self = this;

			$('.node').each(function() {

				var actionName = el.attr('name'),
					action = self.actions[actionName],
					target = self.flow.nodes[$(this).attr('id')];
			
				// prevent inserting callflow action where selected action is a terminating action
				if (action.isTerminating == 'true' && target.terminatingAction().isTerminating != 'true') {

					var activate = true,
						target = self.flow.nodes[$(this).attr('id')];

					if (el.attr('name') in target.potentialChildren()) {
						if (el.hasClass('node') && self.flow.nodes[el.attr('id')].contains(target)) {
							activate = false;
						}
					} else {
						activate = false;
					}

					if (activate) {
						$(this).addClass('active');
					} else {
						$(this).addClass('inactive');
						$(this).droppable('disable');
					}
				
				}

				else {

					var activate = true,
						target = self.flow.nodes[$(this).attr('id')];

					// prevent adding child actions to a terminating action
					if (target.terminatingAction().isTerminating == 'true') {

						// added support for new rule type of allowedChildren - allows adding callflow as child action of pivot as an example
						if (el.attr('name') in target.potentialChildren() && Array.isArray(target.allowedChildren()) && target.allowedChildren().includes(el.attr('name'))) {

							if (el.hasClass('node') && self.flow.nodes[el.attr('id')].contains(target)) {
								activate = false;
							}
						} else {
							activate = false;
						}

						if (activate) {
							$(this).addClass('active');
						} else {
							$(this).addClass('inactive');
							$(this).droppable('disable');
						}	

					}

				}
			
			});
			
		},

		disableDestinations: function() {
			
			$('.node').each(function() {
				$(this).removeClass('active');
				$(this).removeClass('inactive');
				$(this).droppable('enable');
			});

			$('.tool').removeClass('active');

		},
		
		save: function() {
			var self = this,
				metadata = self.dataCallflow.hasOwnProperty('ui_metadata') ? self.dataCallflow.ui_metadata : false,
				isHiddenCallflow = metadata && metadata.hasOwnProperty('origin') && _.includes(['voip', 'migration', 'mobile', 'callqueues'], metadata.origin),
				showAllCallflows = (monster.config.hasOwnProperty('developerFlags') && monster.config.developerFlags.showAllCallflows) || monster.apps.auth.originalAccount.superduper_admin;

			if (miscSettings.enableConsoleLogging == true || false) {
				console.log('Callflow Metadata', metadata)
				console.log('Hidden Callflow', isHiddenCallflow)
				console.log('Show All Callflows', showAllCallflows)
			}

			if (self.flow.numbers && self.flow.numbers.length > 0) {
				var data_request = {
					numbers: self.flow.numbers,
					flow: (self.flow.root.children[0] === undefined) ? {} : self.flow.root.children[0].serialize()
				};

				if (self.flow.name !== '') {
					data_request.name = self.flow.name;
				} else {
					delete data_request.name;
					delete self.dataCallflow.name;
				}

				if ('contact_list' in self.flow) {
					data_request.contact_list = { exclude: self.flow.contact_list.exclude || false };
				}

				// We don't want to keep the old data from the flow, so we override it with what's on the current screen before the extend.
				self.dataCallflow.flow = data_request.flow;
				// Change dictated by the new field added by monster-ui. THis way we can potentially update callflows in Kazoo UI without breaking monster.
				data_request = $.extend(true, {}, self.dataCallflow, data_request);
				delete data_request.metadata;

				if (self.flow.id) {
					// if show all callflows is enabled and this is a hidden callflow then retain existing ui_metadata 
					if (showAllCallflows == true && isHiddenCallflow == true) {
						self.callApi({
							resource: 'callflow.update',
							data: {
								accountId: self.accountId,
								callflowId: self.flow.id,
								data: {
									...data_request,
									ui_metadata: {
										...metadata
									}
								},
								removeMetadataAPI: true
							},
							success: function(json) {
								selectedItemId = json.data.id
								self.repaintList();
								self.editCallflow({ id: json.data.id });
							}
						});
					}

					else {
						self.callApi({
							resource: 'callflow.update',
							data: {
								accountId: self.accountId,
								callflowId: self.flow.id,
								data: data_request
							},
							success: function(json) {
								selectedItemId = json.data.id
								self.repaintList();
								self.editCallflow({ id: json.data.id });
							}
						});
					}

				} else {
					self.callApi({
						resource: 'callflow.create',
						data: {
							accountId: self.accountId,
							data: data_request
						},
						success: function(json) {
							selectedItemId = json.data.id
							self.repaintList();
							self.editCallflow({ id: json.data.id });
						}
					});
				}
			} else {
				monster.ui.alert(self.i18n.active().oldCallflows.you_need_to_select_a_number);
			}
		},

		winkstartTabs: function(template, advanced) {
			var buttons = template.find('.view-buttons'),
				tabs = template.find('.tabs');

			if (advanced) {
				buttons.find('.btn').removeClass('activate');
				buttons.find('.advanced').addClass('activate');
			} else {
				if (monster.config.advancedView || miscSettings.hideBasicAdvancedButton) {
					buttons.find('.btn').removeClass('activate');
					buttons.find('.advanced').addClass('activate');
				} else {
					tabs.hide('blind');
				}
			}

			if (tabs.find('li').length < 2) {
				buttons.hide();
			}

			buttons.find('.basic').on('click', function() {
				var $this = $(this);

				if (!$this.hasClass('activate')) {
					buttons.find('.btn').removeClass('activate');
					$this.addClass('activate');
					tabs.find('li:first-child > a').trigger('click');
					tabs.hide('blind');
				}
			});

			buttons.find('.advanced').click(function() {
				var $this = $(this);

				if (!$this.hasClass('activate')) {
					buttons.find('.btn').removeClass('activate');
					$this.addClass('activate');
					tabs.show('blind');
				}
			});

			tabs.find('li').on('click', function(ev) {
				ev.preventDefault();

				var $this = $(this),
					link = $this.find('a').attr('href');

				tabs.find('li').removeClass('active');
				template.find('.pill-content >').removeClass('active');

				$this.addClass('active');
				template.find(link).addClass('active');
			});
		},

		winkstartLinkForm: function(html) {
			$('input', html).bind('change.link keyup.link focus.link', function() {
				var input = $(this),
					name = input.attr('name'),
					type = input.attr('type'),
					value = input.val(),
					id = input.attr('id'),
					input_fields = $('input[name="' + name + '"]', html);

				if (input_fields.size() > 1) {
					if (type === 'checkbox') {
						input_fields = input_fields.filter('[value=' + value + ']');
						(input.attr('checked')) ? input_fields.attr('checked', 'checked') : input_fields.removeAttr('checked');
					} else {
						$.each(input_fields, function(k, v) {
							var element = $(v);

							if (element.attr('id') !== id) {
								element.val(value);
							}
						});
					}
				} else {
					input.unbind('.link');
				}
			});
		},

		isDeviceCallable: function(device) {
			// TODO: this validation should be removed once the backend returns the actual meta device status.
			if (device.device_type === 'meta') {
				return true;
			}

			return _.every([
				device.enabled,
				device.registrable ? device.registered : true
			]);
		},

		/**
		 * Recursively unsets `obj`'s empty properties by mutating it
		 * @param  {Object} obj  Object to compact
		 */
		compactObject: function(obj) {
			var self = this;
			_.each(obj, function(value, key) {
				if (_.isPlainObject(value)) {
					self.compactObject(value);
				}
				if (_.isEmpty(value)) {
					_.unset(obj, key);
				}
			});
		},

		list_classifiers: function(callback) {
			var self = this;
			self.callApi({
				resource: 'numbers.listClassifiers',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(_data_classifiers, status) {
							
					if ('data' in _data_classifiers && typeof hideClassifiers === 'object') {

						var formattedClassifiers = {}
						
						$.each(_data_classifiers.data, function(k, v) {
							
							// check if k exists in hideClassifiers and its value is true
							if (hideClassifiers.hasOwnProperty(k) && hideClassifiers[k] === true) {

								return; 
						
							}

							else {

								// if k is not in hideClassifiers or its value is not true
								formattedClassifiers[k] = {
									friendly_name: v.friendly_name
								};

							}

							_data_classifiers.data = formattedClassifiers;

						});
					}

					callback(null, formattedClassifiers);

				}
			});
		}
					
		
		

		

	};

	return app;
});