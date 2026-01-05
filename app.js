define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		accountData = {},
		isReseller = false,
		uk999Enabled = false,
		hideFromMenu = {},
		hideAdd = {},
		hideCallflowAction = {},
		userCallflowAction = {},
		hideFromCallflowAction = {},
		hideClassifiers = {},
		billingCodes = {},
		miscSettings = {},
		hideDeviceTypes = {},
		ttsLanguages = {},
		deviceAudioCodecs = {},
		deviceVideoCodecs = {},
		afterBridgeTransfer = {},
		callflowFlags = [],
		callTags = [],
		contactDirectories = [],
		hideFeatureCode = {},
		pusherApps = {},
		deviceBillingCodeRequired = {},
		anankeCallbacks = {};

	var appSubmodules = [
		'afterbridge',
		'blacklist',
		'branchvariable',
		'callcenter',
		'conference',
		'device',
		'directory',
		'eavesdrop',
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
		subscribe: {
			'callflows.callflow.popupEdit': 'callflowPopupEdit'
		},

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

			monster.waterfall([
				
				function(callback) {
					self.callApi({
						resource: 'account.get',
						data: {
							accountId: self.accountId
						},
						success: function(data) {
							accountData = data.data;
							callback(null);
						}
					});
				},

				function() {

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
								// support for original hideFromMenu format
								if (Array.isArray(data.dimension.dt_callflows.hideFromMenu)) {
									data.dimension.dt_callflows.hideFromMenu.forEach(function(action) {
										hideFromMenu[action] = true;
									});
								} else {
									hideFromMenu = data.dimension.dt_callflows.hideFromMenu;
								}
							}

							if (data.dimension.dt_callflows.hasOwnProperty('hideAdd')) {															
								// support for original hideAdd format
								if (Array.isArray(data.dimension.dt_callflows.hideAdd)) {
									data.dimension.dt_callflows.hideAdd.forEach(function(action) {
										hideAdd[action] = true;
									});
								} else {
									hideAdd = data.dimension.dt_callflows.hideAdd;
								}
							}

							if (data.dimension.dt_callflows.hasOwnProperty('hideCallflowAction')) {															
								// support for original hideCallflowAction format
								if (Array.isArray(data.dimension.dt_callflows.hideCallflowAction)) {
									data.dimension.dt_callflows.hideCallflowAction.forEach(function(action) {
										hideCallflowAction[action] = true;
									});
								} else {
									hideCallflowAction = data.dimension.dt_callflows.hideCallflowAction;
								}
							}

							if (data.dimension.dt_callflows.hasOwnProperty('userCallflowAction')) {															
								userCallflowAction = data.dimension.dt_callflows.userCallflowAction;
							}

							if (data.dimension.dt_callflows.hasOwnProperty('hideFromCallflowAction')) {
								Object.keys(data.dimension.dt_callflows.hideFromCallflowAction).forEach(function(key) {
									// support for original hideFromCallflowAction format
									if (Array.isArray(data.dimension.dt_callflows.hideFromCallflowAction[key])) {
										data.dimension.dt_callflows.hideFromCallflowAction[key].forEach(function(action) {
											if (!hideFromCallflowAction.hasOwnProperty(key)) {
												hideFromCallflowAction[key] = {};
											}
											hideFromCallflowAction[key][action] = true;
										});
									} else {
										hideFromCallflowAction = data.dimension.dt_callflows.hideFromCallflowAction;
									}
								})
							}

							if (data.dimension.dt_callflows.hasOwnProperty('hideClassifiers')) {															
								data.dimension.dt_callflows.hideClassifiers.forEach(function(action) {
									hideClassifiers[action] = true;
								});
							}

							if (data.dimension.dt_callflows.hasOwnProperty('miscSettings')) {
								// support for original miscSettings format
								if (Array.isArray(data.dimension.dt_callflows.miscSettings)) {
									data.dimension.dt_callflows.miscSettings.forEach(function(action) {
										miscSettings[action] = true;
									});
								} else {
									miscSettings = data.dimension.dt_callflows.miscSettings;
								}
							}

							if (data.dimension.dt_callflows.hasOwnProperty('hideDeviceTypes')) {															
								// support for original hideDeviceTypes format
								if (Array.isArray(data.dimension.dt_callflows.hideDeviceTypes)) {
									data.dimension.dt_callflows.hideDeviceTypes.forEach(function(action) {
										hideDeviceTypes[action] = true;
									});
								} else {
									hideDeviceTypes = data.dimension.dt_callflows.hideDeviceTypes;
								}
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

							if (data.dimension.dt_callflows.hasOwnProperty('afterBridgeTransfer')) {
								afterBridgeTransfer = data.dimension.dt_callflows.afterBridgeTransfer
							}

							if (data.dimension.dt_callflows.hasOwnProperty('hideFeatureCode')) {															
								// support for original hideFeatureCode format
								if (Array.isArray(data.dimension.dt_callflows.hideFeatureCode)) {
									data.dimension.dt_callflows.hideFeatureCode.forEach(function(action) {
										hideFeatureCode[action] = true;
									});
								} else {
									hideFeatureCode = data.dimension.dt_callflows.hideFeatureCode;
								}
							}

							if (data.dimension.dt_callflows.hasOwnProperty('pusherApps')) {
								pusherApps = data.dimension.dt_callflows.pusherApps;
							}

							if (data.dimension.dt_callflows.hasOwnProperty('billingCodes')) {
								if (Array.isArray(data.dimension.dt_callflows.billingCodes)) {
									billingCodes = data.dimension.dt_callflows.billingCodes
										.filter(code => code && code.id && code.name)
										.map(code => ({
											id: code.id.trim(),
											name: code.name.trim()
										}));
								}
							}

							if (data.dimension.dt_callflows.hasOwnProperty('deviceBillingCodeRequired')) {															
								deviceBillingCodeRequired = data.dimension.dt_callflows.deviceBillingCodeRequired;
							}

							if (data.dimension.dt_callflows.hasOwnProperty('anankeCallbacks')) {
								anankeCallbacks = data.dimension.dt_callflows.anankeCallbacks
							}

						}

					}

					// set miscSettings.enableDimensionsCallTagAction check account doc for call tag data
					if (miscSettings.enableDimensionsCallTagAction) {
						if (accountData.hasOwnProperty('dimension') && accountData.dimension.hasOwnProperty('tags')) {
							callTags = accountData.dimension.tags;
							// sort contactDirectories alphabetically by name
							callTags.sort((a, b) => {
								return a.name.localeCompare(b.name);
							});
						} else {
							callTags = [];
						}
					}

					// set miscSettings.enableDimensionsCallTagAction check account doc for call tag data
					if (miscSettings.enableDimensionsDirectoryRoutingAction) {
						if (accountData.hasOwnProperty('dimension') && accountData.dimension.hasOwnProperty('directories')) {
							contactDirectories = accountData.dimension.directories;
							// sort contactDirectories alphabetically by name
							contactDirectories.sort((a, b) => {
								return a.name.localeCompare(b.name);
							});
						} else {
							contactDirectories = [];
						}
					}

					// set miscSettings.enableTenantProfileSettings and configure tenantProfileSettings to specify which actions are available based on the tenant profile assigned to the customer
					if (miscSettings.enableTenantProfileSettings) {
						if (accountData.hasOwnProperty('dimension') && accountData.dimension.hasOwnProperty('tenant_profile')) {
							var tenantProfile = accountData.dimension.tenant_profile;

							if (miscSettings.enableConsoleLogging) {
								console.log('Tenant Profile:', tenantProfile);
							}

							if (data.dimension.dt_callflows.hasOwnProperty('tenantProfileSettings')) {
								var profileId = tenantProfile.id,
									profileSettings = data.dimension.dt_callflows.tenantProfileSettings;
							
								// tenant profile callflow action overrides
								if (profileSettings.hasOwnProperty(profileId) && profileSettings[profileId].hasOwnProperty('hideCallflowAction')) {							
									var callflowActions = profileSettings[profileId].hideCallflowAction;
							
									for (var key in callflowActions) {
										if (callflowActions.hasOwnProperty(key)) {
											hideCallflowAction[key] = callflowActions[key];
										}
									}
							
									if (miscSettings.enableConsoleLogging) {
										console.log('Tenant Profile Callflow Action Overrides:', callflowActions);
									}
								}

								// tenant profile callflow menu overrides
								if (profileSettings.hasOwnProperty(profileId) && profileSettings[profileId].hasOwnProperty('hideFromMenu')) {
									var menuItems = profileSettings[profileId].hideFromMenu;

									for (var key in menuItems) {
										if (menuItems.hasOwnProperty(key)) {
											hideFromMenu[key] = menuItems[key];
										}
									}
							
									if (miscSettings.enableConsoleLogging) {
										console.log('Tenant Profile Menu Item Overrides:', menuItems);
									}
								}

								// tenant profile feature codes overrides
								if (profileSettings.hasOwnProperty(profileId) && profileSettings[profileId].hasOwnProperty('hideFeatureCode')) {
									var featureCodes = profileSettings[profileId].hideFeatureCode;

									for (var key in featureCodes) {
										if (featureCodes.hasOwnProperty(key)) {
											hideFeatureCode[key] = featureCodes[key];
										}
									}
							
									if (miscSettings.enableConsoleLogging) {
										console.log('Tenant Profile Feature Code Overrides:', featureCodes);
									}
								}
							}
						}
					}

					// set miscSettings.hideCallRestictions based on account type if not explicitly set
					if (miscSettings.hideCallRestictions == undefined) {

						if (isReseller == true) {
							miscSettings.hideCallRestictions = false
						} else {
							miscSettings.hideCallRestictions = true
						}
					
					}

					// enableConsoleLogging if url variable enableConsoleLogging is true
					var urlVariables = {};
					
					urlVariables = monster.util.getUrlVars();
					
					if (urlVariables.enableConsoleLogging === 'true') {
						miscSettings.enableConsoleLogging = true
					}

					// log to console if enabled
					if (miscSettings.enableConsoleLogging) {
						console.log('hideFromMenu:', hideFromMenu);
						console.log('hideAdd:', hideAdd);
						console.log('hideCallflowAction:', hideCallflowAction);
						console.log('userCallflowAction:', userCallflowAction);
						console.log('hideFromCallflowAction:', hideFromCallflowAction);
						console.log('hideClassifiers:', hideClassifiers);
						console.log('miscSettings:', miscSettings);
						console.log('hideDeviceTypes:', hideDeviceTypes);
						console.log('ttsLanguages:', ttsLanguages);
						console.log('deviceAudioCodecs:', deviceAudioCodecs);
						console.log('deviceVideoCodecs:', deviceVideoCodecs);
						console.log('afterBridgeTransfer:', afterBridgeTransfer);
						console.log('callTags:', callTags);
						console.log('contactDirectories', contactDirectories);
						console.log('accountData:', accountData);
						console.log('hideFeatureCode:', hideFeatureCode);
						console.log('pusherApps:', pusherApps);
						console.log('billingCodes:', billingCodes);
						console.log('deviceBillingCodeRequired:', deviceBillingCodeRequired);
						console.log('anankeCallbacks:', anankeCallbacks);
					}

					monster.pub('callflows.fetchActions', { actions: self.actions, hideAdd, hideCallflowAction, hideFromCallflowAction, hideClassifiers, billingCodes, miscSettings, hideDeviceTypes, ttsLanguages, deviceAudioCodecs, deviceVideoCodecs, afterBridgeTransfer, callTags, contactDirectories, pusherApps, deviceBillingCodeRequired, anankeCallbacks });
					self.renderEntityManager(parent);

					// show warning message if emergency caller id has not been set on the account
					if (miscSettings.checkEmergencyNumber) {

						// check if 'uk_999_enabled' exists and is true on account doc
						if (accountData.hasOwnProperty('dimension')) {
							uk999Enabled = (accountData.dimension.hasOwnProperty('uk_999_enabled') && accountData.dimension.uk_999_enabled == true) ? true : false;	
						} else {
							uk999Enabled = false;
						}

						// check if emergency caller id has been set on the account
						if (accountData.hasOwnProperty('caller_id') && accountData.caller_id.hasOwnProperty('emergency') && accountData.caller_id.emergency.hasOwnProperty('number')) {
							if (miscSettings.checkEmergencyAddress999) {
								if (uk999Enabled == true) {
									self.callApi({
										resource: 'numbers.get',
										data: {
											accountId: self.accountId,
											phoneNumber: accountData.caller_id.emergency.number
										},
										success: function(data) {
											if (!data.data.hasOwnProperty('dimension') || !data.data.dimension.hasOwnProperty('uk_999')) {
												monster.ui.alert('warning', self.i18n.active().callflows.uk999.emergencyCallerIdAddressNotSet);												
											}
										}
									});
								}
							}

							if (miscSettings.checkEmergencyAddress911) {
								self.callApi({
									resource: 'numbers.get',
									data: {
										accountId: self.accountId,
										phoneNumber: accountData.caller_id.emergency.number
									},
									success: function(data) {
										if (!data.data.hasOwnProperty('e911')) {
											monster.ui.alert('warning', self.i18n.active().callflows.e911.emergencyCallerIdAddressNotSet);
										}
									}
								});
							}

						} else {
							// emergency caller id has not been set on the account
							if (miscSettings.checkEmergencyAddress999) {
								monster.ui.alert('warning', self.i18n.active().callflows.uk999.emergencyCallerIdNotSet);
							}
							else if (miscSettings.checkEmergencyAddress911) {
								monster.ui.alert('warning', self.i18n.active().callflows.e911.emergencyCallerIdNotSet);
							}
														
						}
						
					}
					
				}

			]);

			// add additional handle bar support
			Handlebars.registerHelper('includes', function(array, value, options) {
				if (Array.isArray(array) && array.includes(value)) {
					return options.fn(this);
				}
				return options.inverse(this);
			});

			Handlebars.registerHelper('eq', function(a, b) {
				return a === b;
			});

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

					// hide scrollbar within callflow designer - previously under setting miscSettings.hideScrollbars
					$('#ws_callflow .tools', callflowsTemplate).addClass('scrollbar-hidden');
					$('#ws_callflow .flowchart', callflowsTemplate).addClass('scrollbar-hidden');

					// enable zoom control
					self.setupZoomControls(callflowsTemplate);
			
					// enable moving around the callflow workspace
					self.enableInfinitePanning();
				}
			});

		},

		setupZoomControls: function(callflowsTemplate) {

			this.zoomLevel = 1;
			const zoomStep = 0.1;
			const minZoom = 0.5;
			const maxZoom = 2;
			const flowContainer = callflowsTemplate.find("#ws_callflow .callflow");
		
			if (!flowContainer.length) return;
		
			// zoom in control
			callflowsTemplate.find(".zoom-in-button").click(() => {
				if (this.zoomLevel < maxZoom) {
					this.zoomLevel += zoomStep;
					this.updateZoom(flowContainer);
				}
			});
		
			// zoom out control
			callflowsTemplate.find(".zoom-out-button").click(() => {
				if (this.zoomLevel > minZoom) {
					this.zoomLevel -= zoomStep;
					this.updateZoom(flowContainer);
				}
			});
		
			// reset view control
			callflowsTemplate.find(".reset-view-button").click(() => {
				this.resetView();
			});
		},

		resetView: function() {
			const flowContainer = $("#ws_callflow .callflow");
			if (!flowContainer.length) return;
		
			this.zoomLevel = 1;

			this.updateZoom(flowContainer);
			this.resetFlowState();
		},

		updateZoom: function(flowContainer) {
			if (!flowContainer || !flowContainer.length) return;
		
			const zoom = this.zoomLevel || 1;
		
			flowContainer.css({
				transform: `scale(${zoom})`,
				transformOrigin: 'top left',
				width: `${100 / zoom}%`,
				height: `${100 / zoom}%`
			});
		},

		calculateAnchorNodes: function() {

			const flowContainer = document.getElementById("ws_cf_flow");
			if (!flowContainer) return;
		
			const nodes = Array.from(flowContainer.querySelectorAll(".node"));
			let maxBottom = -Infinity;
			let minLeft = Infinity;
			let maxRight = -Infinity;
		
			let leftmostNode = null;
			let rightmostNode = null;
			let lowestNode = null;
		
			nodes.forEach((node) => {
				const top = node.offsetTop;
				const height = node.offsetHeight;
				const bottom = top + height;
		
				const left = node.offsetLeft;
				const width = node.offsetWidth;
				const right = left + width;
		
				if (bottom > maxBottom) {
					maxBottom = bottom;
					lowestNode = node;
				}
				if (left < minLeft) {
					minLeft = left;
					leftmostNode = node;
				}
				if (right > maxRight) {
					maxRight = right;
					rightmostNode = node;
				}
			});
		
			const self = this;
			self.lowestNode = lowestNode;
			self.leftmostNode = leftmostNode;
			self.rightmostNode = rightmostNode;
			self.lowestNodeBottomOffset = maxBottom;

		},

		enableInfinitePanning: function () {

			const self = this;
			const flowWrapper = document.getElementById("ws_cf_wrapper");
			const flowContainer = document.getElementById("ws_cf_flow");
		
			if (!flowWrapper || !flowContainer) return;
		
			let isPanning = false;
			let startX, startY;
			
			self.translateX = parseFloat(flowContainer.dataset.translateX) || 0;
			self.translateY = parseFloat(flowContainer.dataset.translateY) || 0;
		
			flowWrapper.addEventListener("mousedown", function (e) {
				if (e.target.closest(".node") || e.target.closest(".monster-button")) return;
		
				document.body.style.userSelect = "none";
				isPanning = true;
				startX = e.clientX;
				startY = e.clientY;

				self.startTranslateX = self.translateX;
				self.startTranslateY = self.translateY;

				self.calculateAnchorNodes();
				flowWrapper.classList.add("dragging");

			});
		
			document.addEventListener("mousemove", function (e) {
				if (!isPanning) return;
				e.preventDefault();
			
				let deltaX = e.clientX - startX;
				let deltaY = e.clientY - startY;
			
				let proposedX = self.startTranslateX + deltaX;
				let proposedY = self.startTranslateY + deltaY;

				const clamped = self.applyClampedPan(proposedX, proposedY);
				proposedX = clamped.x;
				proposedY = clamped.y;

				flowContainer.style.transform = `translate(${proposedX}px, ${proposedY}px)`;

				self.translateX = proposedX;
				self.translateY = proposedY;
			});
		
			document.addEventListener("mouseup", function () {
				if (!isPanning) return;
		
				isPanning = false;
				document.body.style.userSelect = "";
				flowWrapper.classList.remove("dragging");
		
				flowContainer.dataset.translateX = self.translateX;
				flowContainer.dataset.translateY = self.translateY;
			});
		
			// smooth scrolling
			let scrollVelocityY = 0;
			let scrollVelocityX = 0;
			let isScrolling = false;
		
			function animateScroll() {
				if (Math.abs(scrollVelocityY) > 0.1 || Math.abs(scrollVelocityX) > 0.1) {
					let proposedX = self.translateX - scrollVelocityX;
					let proposedY = self.translateY - scrollVelocityY;
			
					// apply clamping
					const clamped = self.applyClampedPan(proposedX, proposedY);
					self.translateX = clamped.x;
					self.translateY = clamped.y;
			
					scrollVelocityX *= 0.85;
					scrollVelocityY *= 0.85;
			
					flowContainer.style.transform = `translate(${self.translateX}px, ${self.translateY}px)`;
					flowContainer.dataset.translateX = self.translateX;
					flowContainer.dataset.translateY = self.translateY;
			
					requestAnimationFrame(animateScroll);
				} else {
					isScrolling = false;
				}
			}
			
			flowWrapper.addEventListener("wheel", function (e) {

				if (e.ctrlKey) return;

				e.preventDefault();

				// if shift is held: treat vertical wheel (deltaY) as a horizontal
				if (e.shiftKey) {
					scrollVelocityX += e.deltaY * 0.2;
				} else {
					// no shift: normal behavior
					scrollVelocityX += e.deltaX * 0.2;
					scrollVelocityY += e.deltaY * 0.2;
				}

				if (!isScrolling) {
					self.calculateAnchorNodes();
					isScrolling = true;
					requestAnimationFrame(animateScroll);
				}
			});

		},	
		
		applyClampedPan: function(proposedX, proposedY) {
			const self = this;
			const zoom = self.zoomLevel;
			const viewportBottom = window.scrollY + window.innerHeight;
			const viewportWidth = document.documentElement.clientWidth;
		
			// clamp bottom (root node must stay visible)
			const rootNode = document.getElementById("0");
			if (rootNode) {
				const rootRect = rootNode.getBoundingClientRect();
				const projectedBottom = rootRect.bottom + (proposedY - self.translateY) * zoom + 30;
				if (projectedBottom > viewportBottom) {
					const overshoot = projectedBottom - viewportBottom;
					proposedY -= overshoot / zoom;
				}
			}
		
			// clamp top (lowest node can't go above screen)
			if (self.lowestNode) {
				const rect = self.lowestNode.getBoundingClientRect();
				const projectedTop = rect.top + (proposedY - self.translateY) * zoom;
				if (projectedTop < 210) {
					const overshootY = 210 - projectedTop;
					proposedY += overshootY / zoom;
				}
			}
		
			// clamp left (rightmost node can't go off left)
			if (self.rightmostNode) {
				const rect = self.rightmostNode.getBoundingClientRect();
				const projectedLeftEdge = rect.left + (proposedX - self.translateX) * zoom;
				const bufferLeft = 243;
				if (projectedLeftEdge < bufferLeft) {
					const overshootX = bufferLeft - projectedLeftEdge;
					proposedX += overshootX / zoom;
				}
			}
		
			// clamp right (leftmost node can't go off right)
			if (self.leftmostNode) {
				const rect = self.leftmostNode.getBoundingClientRect();
				const projectedRightEdge = rect.right + (proposedX - self.translateX) * zoom;
				const bufferRight = 0;
				const rightLimit = viewportWidth - bufferRight;
				if (projectedRightEdge > rightLimit) {
					const overshootX = projectedRightEdge - rightLimit;
					proposedX -= overshootX / zoom;
				}
			}
		
			return { x: proposedX, y: proposedY };
		},

		resetFlowState: function() {
			const flowContainer = document.getElementById("ws_cf_flow");
			const wrapper = document.getElementById("ws_cf_wrapper");
		
			if (!flowContainer || !wrapper) return;
		
			const wrapperWidth = wrapper.clientWidth;
			const wrapperHeight = wrapper.clientHeight;
			const flowWidth = flowContainer.offsetWidth;
			const flowHeight = flowContainer.offsetHeight;
		
			const centerX = (wrapperWidth - flowWidth) / 2;
			const centerY = (wrapperHeight - flowHeight) / 2;
		
			// set transform
			flowContainer.style.transform = `translate(${centerX}px, ${centerY}px) scale(1)`;

			// save in dataset
			flowContainer.dataset.translateX = centerX;
			flowContainer.dataset.translateY = centerY;
		
			// save globally for panning
			this.translateX = centerX;
			this.translateY = centerY;
		
			flowContainer.style.height = `${wrapperHeight}px`;
		},

		syncFlowHeight: function() {
			const flowchart = document.querySelector(".flowchart");
			const flowContainer = document.getElementById("ws_cf_flow");
		
			if (!flowchart || !flowContainer) return;
		
			flowchart.getBoundingClientRect();
		
			let flowchartHeight = flowchart.offsetHeight;
		
			if (flowchartHeight > 0) {
				flowContainer.style.height = `${flowchartHeight}px`;
			}
		},

		bindCallflowsEvents: function(template, container) {
			var self = this,
				callflowList = template.find('.callflow-manager .list-container .list'),
				isLoading = false,
				loader = $('<li class="content-centered list-loader"> <i class="fa fa-spinner fa-spin"></i></li>'),
				searchLink = $(self.getTemplate({
					name: 'callflowList-searchLink'
				}));

			template.find('.superadmin-mode #switch_role').on('change', function(e) {
				self.appFlags.showAllCallflows = $(this).is(':checked');

				self.renderCallflows(container);
			});

			// add Callflow
			template.find('.list-add').on('click', function() {
				template.find('.callflow-content')
					.removeClass('listing-mode')
					.addClass('edition-mode');
				
				$('.list-element').removeClass('selected-element');
				
				self.editCallflow();
			});

			// edit Callflow
			callflowList.on('click', '.list-element', function() {
				var $this = $(this),
					callflowId = $this.data('id');

				// remove existing callflow from view when selecting a new callflow
				$('#ws_callflow .flowchart').hide();

				$('.list-element').removeClass('selected-element');
				$this.addClass('selected-element');

				document.addEventListener("DOMContentLoaded", self.syncFlowHeight);

				const observer = new MutationObserver(() => {
					self.syncFlowHeight();
				});

				const flowchart = document.querySelector(".flowchart");
				if (flowchart) {
					observer.observe(flowchart, { attributes: true, childList: true, subtree: true });
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

			// search list
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
							miscSettings: miscSettings,
							hideFeatureCode: hideFeatureCode
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

				$('.list-element').removeClass('selected-element');

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

				$('.list-element').removeClass('selected-element');
				$this.addClass('selected-element');

				template.find('.entity-edition .entity-content').empty();

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

				// clear search and bring the selected item into view
				template.find('.search-query').val('');

				if (data != null) {
					$('.list-element[data-id="' + data.id + '"]').addClass('selected-element');

					var listItem = document.querySelector('.left-bar-container .list li[data-id="' + data.id + '"]');
									
					if (listItem) {
						listItem.scrollIntoView({
							behavior: 'auto',
							block: "center"
						});
					}
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
				},
				isTemporalRoute = function(entity) {
					if (miscSettings.enableEnhancedListData) {
						return entityType === 'temporal_route';
					}
				},
				isVoicemail = function(entity) {
					return entityType === 'voicemail';
				};

			return _.map(entities, function(entity) {

				const displayName = getDisplayName(entity);
				const enhanced = {
					displayName: displayName,
					enableEnhancedListData: miscSettings.enableEnhancedListData,
					entityType: entityType
				};

				// searchable values
				const searchTerms = [
					displayName,
					entity.id,
					entity.presence_id,
					entity.formattedType,
					entity.mac_address,
					entity.enhancedDeviceData?.formattedMac,
					entity.enhancedDeviceData?.forwardingNumber,
					entity.enhancedDeviceData?.presenceId,
					entity.mailbox
				];

				// feature keywords
				const featureLabels = {
					'do_not_disturb': 'Do Not Disturb DND',
					'find_me_follow_me': 'Find Me Follow Me FMFM',
					'call_forward': 'Call Forward FWD',
					'caller_id': 'Caller ID CLIP',
					'hotdesk': 'Hotdesk',
					'voicemail': 'Voicemail VM'
				};

				Object.keys(featureLabels).forEach(feature => {
					if ((entity.features || []).includes(feature)) {
						searchTerms.push(featureLabels[feature]);
					}
				});

				// add numbers to seach if present
				if (Array.isArray(entity.numbers)) {
					searchTerms.push(...entity.numbers);
				}

				// check temporal route
				if (entityType === 'temporal_route' && miscSettings.enableEnhancedListData) {
					searchTerms.push(entity.dimension?.rule_type === 'manual' ? 'Manual Rule Id: ' + entity.dimension.feature_code_id : 'Time Based Rule');
				}

				// cleaned search string
				enhanced.searchText = searchTerms
					.filter(Boolean) 
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim();

				// check for the following
				const hasFeatureIcon =
					(entity.features || []).includes('do_not_disturb') ||
					(entity.features || []).includes('voicemail') ||
					(entity.features || []).includes('find_me_follow_me') ||
					(entity.features || []).includes('call_forward') ||
					(entity.features || []).includes('caller_id') ||
					(entity.features || []).includes('hotdesk') ||
					entity.numbers;

				return _.merge(enhanced, isMediaSource(entity) && {
					additionalInfo: self.i18n.active().callflows.media.mediaSources[entity.media_source]
				}, isUser(entity) && {
					additionalInfo: [
					entity.presence_id,
					hasFeatureIcon ? '<span style="margin-left: 4px; margin-right: 0;">-</span>'	: '',
					(entity.features || []).includes('do_not_disturb') ? '<span class="material-symbols-user-state icon-do-not-disturb" title="Do Not Disturb">do_not_disturb_on</span>' : '',
					(entity.features || []).includes('voicemail') ? '<span class="material-symbols-user-state icon-voicemail" title="Voicemail">voicemail</span>' : '',
					(entity.features || []).includes('find_me_follow_me') ? ' <span class="material-symbols-user-state icon-find-me-follow-me" title="Find Me Follow Me">alt_route</span>' : '',
					(entity.features || []).includes('call_forward') ? ' <span class="material-symbols-user-state icon-forward" title="Call Forward">phone_forwarded</span>' : '',
					(entity.features || []).includes('caller_id') ? ' <span class="material-symbols-user-state icon-caller-id" title="Caller ID">outbound</span>' : '',
					(entity.features || []).includes('hotdesk') ? ' <span class="material-symbols-user-state icon-hotdesk" title="Hotdesk">desk</span>' : '',
					(Array.isArray(entity.numbers) && entity.numbers.length > 0) ? '<span class="material-symbols-user-state icon-numbers" title="Assigned Phone Numbers">numbers</span>' : ''
				].join(' ')
				}, isTemporalRoute(entity) && {
					additionalInfo: entity.dimension?.rule_type === 'manual' ? 'Manual Rule - Feature Code Id: ' + entity.dimension.feature_code_id : 'Time Based Rule'
				}, isVoicemail(entity) && {
					additionalInfo: [
						entity.mailbox,
						'- Messages: ',
						'New: ' + (entity?.folders?.new ?? '0'),
						'Saved: ' + (entity?.folders?.saved ?? '0')
					].join(' ')
				},entity);

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

					var currentRestrictions = {},
						emergencyCallerIdAlertShown;
					
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
		
					_.forEach(monster.util.getCapability('caller_id.external_numbers').isEnabled || miscSettings.enableCallerIdDropdown ? [
						'external',
						'emergency',
						'asserted'
					] : [], function(type) {
						var $target = template.find('.caller-id-' + type + '-target'),
							selectedNumber = _.get(accountSettingsData.account, ['caller_id', type, 'number']);
					
						/*
						if (!$target.length) {
							return;
						}
						*/
					
						var numberList = formattedData.numberList,
							cidNumbers = formattedData.externalNumbers;
					
						if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {

							if (type === 'emergency' || type === 'asserted') {
								numberList = [...formattedData.emergencyCallerIdNumbers];
								allowAddingExternalCallerId = false;
								cidNumbers = [];
							}
						}
					
						var phoneNumbers = { phoneNumbers: numberList.map(num => (typeof num === 'string' ? { number: num } : num)) };
					
						if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
							if (selectedNumber) {
								var isSelectedInList = _.some(phoneNumbers.phoneNumbers, { number: selectedNumber });
					
								if (!isSelectedInList) {
									phoneNumbers.phoneNumbers.unshift({
										number: selectedNumber,
										className: 'invalid-number'
									});
					
									if (miscSettings.enableConsoleLogging) {
										console.log(selectedNumber + ' is set but missing from dropdown, added to ' + type);
									}
								}
							}
						}
					
						monster.ui.cidNumberSelector($target, _.merge({
							allowAdd: allowAddingExternalCallerId,
							noneLabel: self.i18n.active().callflows.accountSettings.callerId.defaultNumber,
							selectName: 'caller_id.' + type + '.number',
							selected: _.get(formattedData.account, ['caller_id', type, 'number']),
							cidNumbers: cidNumbers
						}, phoneNumbers));

						if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
							$target.find('select[name="caller_id.' + type + '.number"]').on('chosen:showing_dropdown chosen:updated', function() {
						
								if (type === 'emergency' || type === 'asserted') {
									
									var emergencyNumbersList = _.map(_.keys(accountSettingsData.emergencyCallerIdNumbers), function(number) {
										return { number: number.replace(/\s+/g, '') };
									});
						
									var $chosenResults = $target.find('.chosen-container .chosen-results li');
						
									$chosenResults.each(function() {
										var $li = $(this),
											liText = $li.text().trim().replace(/\s+/g, '');
						
										if (!/^\+?[0-9]+$/.test(liText)) {
											return;
										}
						
										if (!_.some(emergencyNumbersList, { number: liText })) {
											$li.addClass('invalid-number');
											if ($li.find('.fa-exclamation-circle').length === 0) {
												$li.append(' <i class="no-address fa fa-exclamation-triangle" aria-hidden="true"></i> <span class="no-address-text"> No Address Set</span>');
											}
										}
									});
								}
							});
						}

					});

					if (miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) {
						function invalidEmergencyCallerId() {
	
							template.find('select[name^="caller_id."]').each(function() {
								var $select = $(this),
									selectName = $select.attr('name'),
									selectedValue = $select.val(),
									$chosenSingle = $select.closest('.monster-cid-number-selector-wrapper')
														.find('.chosen-container .chosen-single'),
									emergencyNumbersList = _.keys(accountSettingsData.emergencyCallerIdNumbers);
								
								if (selectName.includes('caller_id.emergency') || selectName.includes('caller_id.asserted')) {

									if (selectedValue && !emergencyNumbersList.includes(selectedValue)) {
										$chosenSingle.addClass('invalid-number');
										if (!emergencyCallerIdAlertShown) {
											if (miscSettings.checkEmergencyAddress911 && miscSettings.restrictEmergencyCallerId911) {
												monster.ui.alert('warning', self.i18n.active().callflows.e911.emergencyCallerIdAddressNotSet);
											}
											if (miscSettings.checkEmergencyAddress999 && miscSettings.restrictEmergencyCallerId999) {
												monster.ui.alert('warning', self.i18n.active().callflows.uk999.emergencyCallerIdAddressNotSet);
											}
											emergencyCallerIdAlertShown = true;
										}
									} else {
										$chosenSingle.removeClass('invalid-number');
									}
									
								}
									
							});
	
						}
	
						invalidEmergencyCallerId();
	
						template.find('select[name^="caller_id."]').change(invalidEmergencyCallerId);
					}
					
					// add search to dropdown
					template.find('#music_on_hold_media_id').chosen({
						width: '224px',
						disable_search_threshold: 0,
						search_contains: true
					})

					monster.ui.tooltips(template);
		
					// Setup input fields
					monster.ui.chosen(template.find('.cid-number-select, .preflow-callflows-dropdown'));
					monster.ui.mask(template.find('.asserted-phone-number'), 'phoneNumber');
		
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
				hasExternalCallerId = monster.util.getCapability('caller_id.external_numbers').isEnabled || miscSettings.enableCallerIdDropdown;

			return _.merge({
				hasExternalCallerId: hasExternalCallerId,
				numberList: _.keys(data.numberList),
				emergencyCallerIdNumbers: _.keys(data.emergencyCallerIdNumbers),
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

			if (miscSettings.readOnlyCallerIdName) {
				template.find('.caller-id-external-number').on('change', function() {
					phoneNumber = $('.caller-id-external-number select[name="caller_id.external.number"]').val();
					formattedNumber = phoneNumber.replace(/^\+44/, '0');
					$('#caller_id_external_name', template).val(formattedNumber);				
				});
			}

			if (miscSettings.readOnlyCallerIdName) {
				template.find('.caller-id-emergency-number').on('change', function() {
					phoneNumber = $('.caller-id-emergency-number select[name="caller_id.emergency.number"]').val();
					formattedNumber = phoneNumber.replace(/^\+44/, '0');
					$('#caller_id_emergency_name', template).val(formattedNumber);
				});
			}

			if (miscSettings.readOnlyCallerIdName) {
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

				// add support for setting caller id privacy on account doc
				if (formData.caller_id_options.outbound_privacy === 'default') {
					delete newData.caller_id_options;
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
					var mediaFilters = { paginate: false };
			
					if (miscSettings.hideMailboxMedia) {
						mediaFilters['filter_not_media_source'] = 'recording';
					}
			
					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId,
							filters: mediaFilters
						},
						success: function(data, status) {
							var mediaList = _.sortBy(data.data, function(item) { return item.name.toLowerCase(); });
							parallelCallback && parallelCallback(null, mediaList);
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
			}, 
			
			(miscSettings.restrictEmergencyCallerId911 || miscSettings.restrictEmergencyCallerId999) && {
				emergencyCallerIdNumbers: function(parallelCallback) {
					var filters = { paginate: false };
			
					if (miscSettings.restrictEmergencyCallerId911) {
						filters.has_key = 'e911';
					}
					
					if (miscSettings.restrictEmergencyCallerId999) {
						filters.has_key = 'dimension.uk_999';
					}
			
					self.callApi({
						resource: 'numbers.list',
						data: {
							accountId: self.accountId,
							filters: filters
						},
						success: function(data, status) {
							parallelCallback && parallelCallback(null, data.data.numbers);
						}
					});
				}
			},
			
			monster.util.getCapability('caller_id.external_numbers').isEnabled && {
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

			$(window).resize(function(e) {
				var $listContainer = container.find('.list-container'),
					$mainContent = container.find('.callflow-content'),
					$tools = container.find('.tools'),
					$flowChart = container.find('.flowchart'),
					contentHeight = window.innerHeight - $('.core-topbar-wrapper').outerHeight(),
					contentHeightPx = contentHeight + 'px',
					innerContentHeightPx = (contentHeight - 71) + 'px';

				// Only run this if the list container exists
				if ($listContainer.length) {
					$listContainer.css('height', window.innerHeight - $listContainer.position().top + 'px');
				}

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
				selectedItemId = args.selectedItemId || null,
				callback = args.callback;

			self.listData({
				callback: function(callflowData) {
					var listCallflows = $(self.getTemplate({
						name: 'callflowList',
						data: { callflows: callflowData.data }
					}));

					template.find('.callflow-manager .list-container .list')
						.empty()
						.append(listCallflows)
						.data('next-key', callflowData.next_start_key || null);
						
					// clear search and bring the selected item into view
					template.find('.search-query').val('');
					
					if (selectedItemId != null) {
						$('.list-element[data-id="' + selectedItemId + '"]').addClass('selected-element');

						var listItem = document.querySelector('.left-bar-container .list li[data-id="' + selectedItemId + '"]');
									
						if (listItem) {
							var listItem = document.querySelector('.left-bar-container .list li[data-id="' + selectedItemId + '"]');
									
							if (listItem) {
								listItem.scrollIntoView({
									behavior: 'auto',
									block: "center"
								});
							}		listItem.scrollIntoView({
								behavior: 'auto',
								block: "center"
							});
						}
					}
					
					callback && callback(callflowData.data);
				},
				searchValue: args.searchValue
			});
		},

		listData: function(args) {
			var callflowFilters = {
				paginate: miscSettings.paginateListCallflows || false,
				filter_not_numbers: 'no_match',
				'filter_not_ui_metadata.origin': [
					'voip',
					'callqueues',
					'callqueues-pro',
					'csv-onboarding'
				]
			};

			var hideModule = [];
			
			if (miscSettings.hideQubicleCallflows) {
				hideModule.push('qubicle');
				callflowFilters['filter_not_flow.module'] = hideModule;
			}

			if (miscSettings.hideAcdcCallflows) {
				hideModule.push('acdc_member');
				callflowFilters['filter_not_flow.module'] = hideModule;
			}

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
					filters: callflowFilters
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
					shortDescription = listNumbers,
					isFeatureCode = callflow.featurecode !== false && !_.isEmpty(callflow.featurecode);

				if (listNumbers.length > 36) {
					shortDescription = listNumbers.substring(0, 36) +  '...';
				}

				if (!isFeatureCode) {
					if (callflow.name) {
						callflow.description = listNumbers;
						callflow.shortDescription = shortDescription;
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
				self.dataCallflow = {};
				self.repaintFlow();
			}

			self.renderButtons(existingCallflow);
			self.renderTools();

			$('.callflow-zoom').show();

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
								$('.callflow-zoom').hide();

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

				$('.list-element').removeClass('selected-element');

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

		buildFlow: function(json, parent, id, key) {
			var self = this,
				branch = self.branch(self.construct_action(json));

			branch.data.data = _.get(json, 'data', {});
			branch.id = ++id;
			branch.key = key;
			branch.disabled = _.get(json, 'data.skip_module');

			// check if the action is a webhook or pivot and adjust the caption logic
			if (json.module == 'webhook' && json.data.hasOwnProperty('dimension')) {
				var nodeCaption = json.data.dimension.name + ': ' + json.data.dimension.tagValue
				branch.caption = nodeCaption;
			} else if (json.module == 'pivot' && json.data.hasOwnProperty('dimension')) {
				var nodeCaption = json.data.dimension.name
				branch.caption = nodeCaption;
			} else if (json.module == 'resources' && json.data.id == 'resources_to_did') {
				var nodeCaption = json.data.to_did
				branch.caption = nodeCaption;
			} else {
				branch.caption = self.actions.hasOwnProperty(branch.actionName) ? self.actions[branch.actionName].caption(branch, self.flow.caption_map) : '';
			}
			
			if (self.actions.hasOwnProperty(parent.actionName) && self.actions[parent.actionName].hasOwnProperty('key_caption')) {
				branch.key_caption = self.actions[parent.actionName].key_caption(branch, self.flow.caption_map);

				// trim branch.key_caption if the length exceeds 22 characters
				if (branch.key_caption.length > 22) {
					branch.key_caption = branch.key_caption.substring(0, 22) + '...';
				}

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
			self.resetView();
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

			callflowFlags = [];

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

			var hideModule = [];
			
			if (miscSettings.hideQubicleCallflows) {
				hideModule.push('qubicle');
			}

			if (miscSettings.hideAcdcCallflows) {
				hideModule.push('acdc_member');
			}

			var metadata = self.dataCallflow.hasOwnProperty('ui_metadata') ? self.dataCallflow.ui_metadata : false,
				module = self.dataCallflow.hasOwnProperty('flow') && self.dataCallflow.flow.hasOwnProperty('module') ? self.dataCallflow.flow.module : false,
				isHiddenCallflow = metadata && metadata.hasOwnProperty('origin') && _.includes(['voip', 'migration', 'mobile', 'callqueues'], metadata.origin) || module && hideModule.includes(module);

			isHiddenCallflow ? $('#hidden_callflow_warning').show() : $('#hidden_callflow_warning').hide();

			// remove null entries from callflowFlags
			callflowFlags = callflowFlags.filter(item => item !== null);

			if (miscSettings.enableConsoleLogging) {
				console.log('callflowFlags', callflowFlags);
			}

			// if modifying users mainUserCallflow remore SmartPBX's Callflow from callflow name
			if (self.isUserCallflowPopup) {
				var cleanedName = (self.dataCallflow.name || '').replace("SmartPBX's Callflow", '');
				$('.callflow-managerPopup .node[name="root"] .top_bar .name').text(cleanedName);
			}

			// show callflow on page
			$('#ws_callflow .flowchart').show();

			// render dynamic connectors
			if (miscSettings.enableDynamicConnectors) {
				self.drawConnections();
			}

		},

		drawConnections: function() {
			var SVG_NS = "http://www.w3.org/2000/svg",
				zoom = this.zoomLevel || 1;

			$('.node').each((_, nodeEl) => {
				var $source = $(nodeEl),
					$childrenWrapper = $source.closest('.branch').find('> .children');
				
				if (!$childrenWrapper.length) return;

				$childrenWrapper.children('.child').each((_, childEl) => {
					var $child = $(childEl),
						$lineContainer = $child.find('.dynamic_line');
					
					if (!$lineContainer.length) return;

					// clear out any old SVGs
					$lineContainer.empty();

					var lineRect = $lineContainer[0].getBoundingClientRect(),
						srcRect = nodeEl.getBoundingClientRect();

					var startX = (srcRect.left + srcRect.width/2 - lineRect.left) / zoom,
						startY = (srcRect.bottom - lineRect.top ) / zoom;

					var tgtRect, isArrow = false,
						$divOpt = $child.children('.div_option');
					
					if ($divOpt.length) {
						tgtRect = $divOpt[0].getBoundingClientRect();
					} else {
						isArrow = true;
						tgtRect = $child.find('> .branch > .node')[0].getBoundingClientRect();
					}

					var endX = (tgtRect.left + tgtRect.width/2 - lineRect.left) / zoom,
						endY = (tgtRect.top - lineRect.top ) / zoom;

					var arrowH = 6,
						arrowGap = 2,
						lineEndY = isArrow ? endY - arrowH - arrowGap : endY;

					// create SVG
					var svg = document.createElementNS(SVG_NS, 'svg');
					svg.setAttribute('class','inline-svg');
					svg.setAttribute('style', 'position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;');

					// connector path
					var path = document.createElementNS(SVG_NS, 'path');
					path.setAttribute('class','connector-path');
					path.setAttribute('d', `
						M ${startX},${startY}
						C ${startX},${(startY + lineEndY)/2}
						${endX},${(startY + lineEndY)/2}
						${endX},${lineEndY}
					`);
					svg.appendChild(path);

					// arrowhead if no div_option
					if (isArrow) {
						var arrow = document.createElementNS(SVG_NS, 'polygon');
						arrow.setAttribute('class','connector-path-arrow');
						var arrowY = endY - arrowH - arrowGap;
						arrow.setAttribute('points', `
							${endX-5},${arrowY}
							${endX+5},${arrowY}
							${endX},${arrowY+arrowH}
						`);
						svg.appendChild(arrow);
					}

					$lineContainer[0].appendChild(svg);
				});
			});
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
					callflowId: data.id,
					generateError: false
				},
				success: function(callflow) {
					var callflow = callflow.data,
						flow = {};

					flow.root = self.branch('root');
					flow.root.key = 'flow';
					flow.numbers = [];
					flow.ui_metadata = {};
					flow.caption_map = {};
					flow.root.index(0);
					flow.nodes = flow.root.nodes();

					flow.id = callflow.id;
					flow.name = callflow.name;
					flow.contact_list = { exclude: 'contact_list' in callflow ? callflow.contact_list.exclude || false : false };
					self.flow.caption_map = callflow.metadata;

					if (callflow.flow.module !== undefined) {
						flow.root = self.buildFlow(callflow.flow, flow.root, 0, '_');
					}

					flow.nodes = flow.root.nodes();
					flow.numbers = callflow.numbers || [];
					flow.ui_metadata = callflow.ui_metadata?.origin;

					//prepare html from callflow

					layout = self.renderBranch(flow.root);
					callback && callback(layout, flow.ui_metadata);

					$('.node', layout).each(function() {
						var node = flow.nodes[$(this).attr('id')],
							$node = $(this),
							node_html;

						if (node.actionName === 'root') {
							$node.removeClass('icons_black root');
							node_html = $(self.getTemplate({
								name: 'root',
								data: {
									name: flow.name || 'Callflow',
									miscSettings: miscSettings
								}
							}));

							for (var counter, size = flow.numbers.length, j = Math.floor((size) / 2) + 1, i = 0; i < j; i++) {
								counter = i * 2;

								var numbers = flow.numbers.slice(counter, (counter + 2 < size) ? counter + 2 : size),
									row = $(self.getTemplate({
										name: 'rowNumber',
										data: {
											numbers: numbers,
											miscSettings: miscSettings
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
									callflow: self.actions[node.actionName],
									miscSettings: miscSettings
								}
							}));
						}
						$(this).append(node_html);

						// check for <br> tags in .module_name and add class if present
						$node.find('.module_name').each(function() {
							if ($(this).html().includes('<br>') && !$(this).hasClass('br')) {
								$(this).addClass('br');
								$(this).siblings('.material-symbols-icon-medium').addClass('icon-adjust');
							}
						});

						// render dynamic connectors
						if (miscSettings.enableDynamicConnectors) {
							self.drawConnections();
						}
						
					});
				}, 
				error: function(data) {
					if (data.error === "404") {
						monster.ui.alert('error', self.i18n.active().callflows.previewError404, null, { title: 'Preview Error' });
					} else {
						monster.ui.alert('error', self.i18n.active().callflows.previewError, null, { title: 'Preview Error' });
					}
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
							name: self.flow.name || 'Callflow',
							miscSettings: miscSettings
						}
					}));

					$('.edit_icon, .material-symbols-icon-callflow-edit', node_html).click(function() {
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
									}),
									miscSettings: miscSettings
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

					$('.number_column .delete, .number_column .material-symbols-icon-number-delete', node_html).click(function() {
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
							callflow: self.actions[node.actionName],
							miscSettings: miscSettings
						}
					}));

					// check for <br> tags in .module_name and add class if present
					node_html.find('.module_name').each(function() {
						if ($(this).html().includes('<br>') && !$(this).hasClass('br')) {
							$(this).addClass('br');
							$(this).siblings('.material-symbols-icon-medium').addClass('icon-adjust');
						}
					});

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

					var nodeId = $(node_html).find('.delete').attr('id') || $(node_html).find('.material-symbols-icon-node-delete').attr('id'),
						previewCallflowId = self.flow.nodes[nodeId].data.data.id,
						popup;

					self.getCallflowPreview({ id: previewCallflowId }, function(callflowPreview, ui_metadata) {
						
						var dialogTemplate = $(self.getTemplate({
							name: 'callflows-callflowElementDetails',
							data: {
								id: previewCallflowId,
								origin: ui_metadata
							}
						}));

						popup = monster.ui.dialog(dialogTemplate, {
							title: self.i18n.active().oldCallflows.callflow_preview_title,
							width: '80%',
							create: function() {
								$(this).closest('.ui-dialog-content.ui-widget-content').addClass('callflow-preview-dialog');
							}
						});

						popup.find('.callflow-preview-section.callflow').append(callflowPreview);

						$('#callflow_jump').click(function() {
							self.editCallflow({ id: previewCallflowId });
							popup.dialog('close').remove();

							$('.list-element').removeClass('selected-element');
							$('li[data-id="' + previewCallflowId + '"]').addClass('selected-element');
							$('.search-query').val('').trigger('keyup');

							// bring the selected callflow into view
							var listItem = document.querySelector('.left-bar-container .list li[data-id="' + previewCallflowId + '"]');
							if (listItem) {
								listItem.scrollIntoView({
									behavior: 'auto',
									block: "center"
								});
							}
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

								// if we move a node, destroy its key and caption
								draggedNode.key = '_';
								draggedNode.key_caption = '';
					
								// store the children of the target temporarily
								var originalChildren = target.children.slice();
					
								// remove the children from the target
								target.children = [];
					
								// add the dragged node below the target
								addChildBelow(target, draggedNode);
					
								// re-add the original children as children of the dragged node
								originalChildren.forEach(function(child) {
									draggedNode.addChild(child);
								});

								/*
								if (draggedNode.parent && ('key_caption' in self.actions[draggedNode.parent.actionName])) {
									draggedNode.key_caption = self.actions[draggedNode.parent.actionName].key_caption(draggedNode, self.flow.caption_map);
								}
								*/
					
								// repaint the flow after all operations are completed
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
			$('.node-options .delete, .node-options .material-symbols-icon-node-delete', layout).click(function() {

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
						display_key: branch.parent && ('key_caption' in self.actions[branch.parent.actionName]),
						miscSettings: miscSettings
					}
				})),
				children;

			// are custom callflow actions are enabled
			if (miscSettings.enableCustomCallflowActions) {
				
				var branchActions = [
					// custom callflow actions
					{
						type: 'userCallflow',
						actionName: 'userCallflow[id=*]',
						captionToRemove: "SmartPBX's Callflow",
					},
					{
						type: 'phoneOnlyCallflow',
						actionName: 'phoneOnlyCallflow[id=*]'
					},
					{
						type: 'callCentreCallflow',
						actionName: 'callCentreCallflow[id=*]',
						captionToRemove: 'Qubicle Callflow'
					},
					{
						type: 'legacyPbxCallflow',
						actionName: 'legacyPbxCallflow[id=*]'
					},
					// custom device actions
					{ 
						type: 'cellphoneDevice', 
						actionName: 'cellphoneDevice[id=*]' 
					},
					{ 
						type: 'smartphoneDevice', 
						actionName: 'smartphoneDevice[id=*]' 
					},
					{ 
						type: 'landlineDevice', 
						actionName: 'landlineDevice[id=*]' 
					},
					{ 
						type: 'softphoneDevice', 
						actionName: 'softphoneDevice[id=*]' 
					},
					{ 
						type: 'faxDevice', 
						actionName: 'faxDevice[id=*]' 
					},
					{ 
						type: 'ataDevice', 
						actionName: 'ataDevice[id=*]' 
					},
					{ 
						type: 'sipUriDevice', 
						actionName: 'sipUriDevice[id=*]' 
					},
					// custom media actions
					{ 
						type: 'mailboxMedia',
						actionName: 'mailboxMedia[id=*]'
					},
					// custom group pickup actions
					{
						type: 'group_pickupUser',
						actionName: 'group_pickupUser[user_id=*]'
					},
					{
						type: 'group_pickupGroup',
						actionName: 'group_pickupGroup[group_id=*]'
					},
					{
						type: 'group_pickupDevice',
						actionName: 'group_pickupDevice[device_id=*]'
					},
					// custom webhook actions
					{
						type: 'dimensionsCallTag',
						actionName: 'dimensionsCallTag[id=*]'
					},
					// custom pivot actions
					{
						type: 'dimensionsDirectoryRouting',
						actionName: 'dimensionsDirectoryRouting[id=*]'
					},
					// custom resource actions
					{
						type: 'resources_to_did',
						actionName: 'resources_to_did[id=*]'
					}
				];
				
				// render action and set callflowFlags when adding custom action to callflow
				branchActions.forEach(action => {
					if (branch.actionName === action.actionName) {

						// Extract identifier type from actionName (e.g., device_id, user_id, id)
						var identifierMatch = action.actionName.match(/\[(\w+)=\*\]/),
							identifierType = identifierMatch ? identifierMatch[1] : 'id',
							branchId = branch.data.data[identifierType],
							branchFlag = `${action.type}[${identifierType}=${branchId}]`;

						// Handle action that has not been set
						if (branchId == 'null' || branchId == null) {
							branch.data.data[identifierType] = action.type;
							branchFlag = `${action.type}[${identifierType}=${action.type}]`;
						}

						// check if callflowsFlags already contains the branchFlag and if not push the flag into callflowFlags
						if (!callflowFlags.includes(branchFlag)) {
							callflowFlags.push(branchFlag);
						}

					}
				});

				// re-render action on load or after save
				if (branch.actionName == 'callflow[id=*]' || branch.actionName == 'device[id=*]' || branch.actionName == 'play[id=*]' || branch.actionName == 'group_pickup[]' || branch.actionName == 'webhook[]' || branch.actionName == 'pivot[]' || branch.actionName == 'resources[]') {
					if (self.dataCallflow.hasOwnProperty('dimension') && self.dataCallflow.dimension.hasOwnProperty('flags')) {
						// Check if the branch id is contained within the flags array
						self.dataCallflow.dimension.flags.forEach(function(flag) {
							var branchId = null,
								branchFlag = null,
								flagParts = flag.match(/(\w+)\[(\w+)=([\w\*]+)\]/);

							if (flagParts) {
								var flagType = flagParts[1],
									identifierType = flagParts[2],
									flagId = flagParts[3];

								// Determine the correct branchId from branch data based on identifier type
								branchId = branch.data.data[identifierType];

								// Iterate over branchActions to match the action type and id
								branchActions.forEach(callflow => {
									// Extract identifier type from callflow actionName (e.g., device_id, user_id, id)
									var actionIdentifierMatch = callflow.actionName.match(/\[(\w+)=\*\]/),
										actionIdentifierType = actionIdentifierMatch ? actionIdentifierMatch[1] : 'id';

									// Check if the flag matches the callflow type and id
									if (flagType === callflow.type && flagId === branchId) {
										branch.actionName = callflow.actionName;
										branchFlag = `${callflow.type}[${actionIdentifierType}=${branchId}]`;

										if (callflow.captionToRemove) {
											branch.caption = branch.caption.replace(callflow.captionToRemove, '');
										}
									}
								});

								// Check if callflowFlags already contains the branchFlag and add if necessary
								if (branchFlag && !callflowFlags.includes(branchFlag)) {
									callflowFlags.push(branchFlag);
								}

							}
						});
						
					} 
					
				}

			}
			
			// trim branch.caption if the length exceeds 22 characters
			if (branch.caption.length > 22) {
				branch.caption = branch.caption.substring(0, 22) + '...';
			} 

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

					// default to including the action
					var includeAction = true;

					// if in user callflow popup, filter actions based on userCallflowAction map
					if (self.isUserCallflowPopup) {					
						var allowedMap = (typeof userCallflowAction === 'object' && userCallflowAction !== null)
							? userCallflowAction
							: null;

						if (allowedMap && Object.keys(allowedMap).length > 0) {
							if (Object.prototype.hasOwnProperty.call(allowedMap, data.key)) {
								includeAction = !!allowedMap[data.key];
							} else {
								// treat missing key as not allowed
								includeAction = false;
							}
						}
					}

					if (includeAction) {
						categories[data.category].push(data);
					}
				}
			});

			$.each(categories, function(key, val) {
				if (key !== basic_cat && key !== advanced_cat && val.length > 0) {
					dataTemplate.categories.push({ key: key, actions: val });
				}
			});

			dataTemplate.categories.sort(function(a, b) {
				return a.key < b.key ? 1 : -1;
			});

			// show basic / advanced ONLY if they have actions
			if (categories[advanced_cat] && categories[advanced_cat].length > 0) {
				dataTemplate.categories.unshift({
					key: advanced_cat,
					actions: categories[advanced_cat]
				});
			}

			if (categories[basic_cat] && categories[basic_cat].length > 0) {
				dataTemplate.categories.unshift({
					key: basic_cat,
					actions: categories[basic_cat]
				});
			}

			$.each(categories, function(idx, val) {
				val.sort(function(a, b) {
					if (a.hasOwnProperty('weight')) {
						return a.weight > b.weight ? 1 : -1;
					}
				});
			});

			tools = $(self.getTemplate({
				name: 'tools',
				data: {
					...dataTemplate,
					miscSettings: miscSettings
				}
			}));

			// set the basic drawer to open (if it exists), otherwise first category
			var $basicCategory = $('#Basic', tools);

			if ($basicCategory.length) {
				$basicCategory.removeClass('inactive').addClass('active');
				$('#Basic .content', tools).show();
			} else {
				// no Basic category – open the first one if present
				var $firstCategory = tools.find('.category').first();
				if ($firstCategory.length) {
					$firstCategory.removeClass('inactive').addClass('active');
					$firstCategory.find('.content').show();
				}
			}

			tools.find('.category .open').each(function() {
				const $open = $(this);
				const isActive = $open.closest('.category').hasClass('active');
				const iconClass = isActive ? 'fa-chevron-up' : 'fa-chevron-down';
				$open.prepend(`<i class="fa ${iconClass}"></i>`);
			});

			$('.category .open', tools).click(function () {
				const $clickedCategory = $(this).parent('.category');

				// if this category is already active, collapse it
				if ($clickedCategory.hasClass('active')) {
					$clickedCategory.find('.content').stop(true, true).slideUp();
					$clickedCategory.removeClass('active').addClass('inactive');
					$(this).find('i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
				} else {
					// close any currently open categories
					tools.find('.category.active').removeClass('active').addClass('inactive').find('.content').stop(true, true).slideUp();
					tools.find('.category .open i').removeClass('fa-chevron-up').addClass('fa-chevron-down');

					// open the clicked category
					$clickedCategory.find('.content').stop(true, true).slideDown();
					$clickedCategory.removeClass('inactive').addClass('active');
					
					$(this).find('i').removeClass('fa-chevron-down').addClass('fa-chevron-up');
				}
			});

			var	$allActions = tools.find('.tool');

			// check for <br> tags in .tool_name and add class if present
			$allActions.find('.tool_name').each(function() {
				if ($(this).html().includes('<br>')) {
					$(this).addClass('br');
				}
			});	

			// create sticky header and scrollable body
			const $header = $('<div class="toolbox-header"></div>')
				.append(tools.find('.title'))
				.append(tools.find('.search-bar'));

			const $body = $('<div class="toolbox-body"></div>')
				.append(tools.find('.category'))
				.append(tools.find('.callflow_helpbox_wrapper'));

			tools.empty().append($header).append($body);

			tools.find('.search-query').on('keyup', function () {
				_.debounce(function ($input) {
					var val = $input.val().toLowerCase();

					if (val) {
						$allActions.each(function () {
							var $action = $(this),
								$category = $action.closest('.category'),
								$content = $category.find('.content'),
								$icon = $category.find('.open i');

							if ($action.data('name').toLowerCase().includes(val)) {
								$action.show();

								if (!$category.hasClass('active')) {
									$category.removeClass('inactive').addClass('active');
									$content.stop(true, true).slideDown();
									$icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
								}
							} else {
								$action.hide();
							}
						});

						// hide categories with no visible children
						tools.find('.category').each(function () {
							var $cat = $(this),
								$content = $cat.find('.content'),
								$icon = $cat.find('.open i');

							if ($cat.find('.tool:visible').length === 0) {
								$cat.removeClass('active').addClass('inactive');
								$content.stop(true, true).slideUp();
								$icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
							}
						});
					} else {
						// reset: show all tools
						tools.find('.tool').show();

						tools.find('.category').each(function () {
							var $cat = $(this),
								$content = $cat.find('.content'),
								$icon = $cat.find('.open i');

							// check if this is the "Basic" category
							if ($cat.attr('id') === 'Basic') {
								$cat.removeClass('inactive').addClass('active');
								$content.stop(true, true).slideDown();
								$icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
							} else {
								$cat.removeClass('active').addClass('inactive');
								$content.stop(true, true).slideUp();
								$icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
							}
						});
					}
				}, 250)($(this));
			});

			$('.tool', tools).hover(
				function () {
					const $this = $(this);
					let $tooltip = $('#action_tooltip');

					if (!$tooltip.length) {
						$tooltip = $('<div id="action_tooltip" class="callflow_helpbox_wrapper"></div>').appendTo('body');
					}

					if ($this.attr('help')) {
						const $toolbox = $('#ws_cf_tools');
						const toolOffset = $this.offset();
						const toolboxOffset = $toolbox.offset();

						$tooltip
							.html($this.attr('help'))
							.css({
								position: "absolute",
								top: toolOffset.top + "px",
								left: (toolboxOffset.left - 185) + "px",
								display: "block",
								zIndex: 100
							});
					}
				},
				function () {
					$('#action_tooltip').hide();
				}
			);

			function action(el) {
				el.draggable({
					start: function() {
						self.enableDestinations($(this));
						$(this).addClass('inactive');
					},
					drag: function() {
						$('#action_tooltip').hide();
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

						if (miscSettings.enableCallflowActionAnimation) {
							$(this).addClass('node-pulse');

							setTimeout(() => {
								$(this).removeClass('node-pulse');
							}, 3000);
						}
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

							if (miscSettings.enableCallflowActionAnimation) {
								$(this).addClass('node-pulse');
	
								setTimeout(() => {
									$(this).removeClass('node-pulse');
								}, 3000);
							}
						} else {
							$(this).addClass('inactive');
							$(this).droppable('disable');
						}	

					} else {

						if (activate) {
							if ($(this).attr('id') === "0" || $(this).attr('name') === "root") {
								$(this).addClass('root-active');
								
								if (miscSettings.enableCallflowActionAnimation) {
									$(this).addClass('node-pulse');
									setTimeout(() => {
										$(this).removeClass('node-pulse');
									}, 3000);
								}
							} else {
								$(this).addClass('active');

								if (miscSettings.enableCallflowActionAnimation) {
									$(this).addClass('node-pulse');
									setTimeout(() => {
										$(this).removeClass('node-pulse');
									}, 3000);
								}
							}
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
				$(this).removeClass('root-active');
				$(this).removeClass('active');
				$(this).removeClass('inactive');
				$(this).droppable('enable');
				if (miscSettings.enableCallflowActionAnimation) {
					$(this).removeClass('node-pulse');
				}
			});

			$('.tool').removeClass('active');

		},

		save: function(args) {

			if (miscSettings.enableModifyMainUserCallflow) {
				var source = null,
					callback = null;

				if (args && typeof args === 'object') {
					source = args.source;
					callback = args.callback;
				}
			}

			var hideModule = [];
			
			if (miscSettings.hideQubicleCallflows) {
				hideModule.push('qubicle');
			}

			if (miscSettings.hideAcdcCallflows) {
				hideModule.push('acdc_member');
			}

			var self = this,
				metadata = self.dataCallflow.hasOwnProperty('ui_metadata') ? self.dataCallflow.ui_metadata : false,
				module = self.dataCallflow.hasOwnProperty('flow') && self.dataCallflow.flow.hasOwnProperty('module') ? self.dataCallflow.flow.module : false,
				isHiddenCallflow = metadata && metadata.hasOwnProperty('origin') && _.includes(['voip', 'migration', 'mobile', 'callqueues'], metadata.origin) || module && hideModule.includes(module),
				showAllCallflows = (monster.config.hasOwnProperty('developerFlags') && monster.config.developerFlags.showAllCallflows) || monster.apps.auth.originalAccount.superduper_admin;

			if (miscSettings.enableConsoleLogging) {
				console.log('Callflow Metadata', metadata)
				console.log('Hidden Callflow', isHiddenCallflow)
				console.log('Show All Callflows', showAllCallflows)
			}

			if (self.flow.numbers && self.flow.numbers.length > 0) {

				var flowNodes = Object.values(self.flow.nodes),
					hasEavesdropFeature = flowNodes.some(node => node.module === 'eavesdrop_feature'),
					data_request = {
						numbers: self.flow.numbers,
						flow: (self.flow.root.children[0] === undefined) ? {} : self.flow.root.children[0].serialize()
					};

				// add pattern if node contains eavesdrop feature
				if (hasEavesdropFeature) {
					var numbersArray = Array.isArray(self.flow.numbers) ? self.flow.numbers : [self.flow.numbers],
						flowPatterns = numbersArray.map(number => '^\\' + number + '([0-9*]*)$');
				
					data_request.patterns = flowPatterns;
					delete self.dataCallflow.patterns;
				}

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

				// set dimensions flags on callflow doc if custom actions enabled
				if (miscSettings.enableCustomCallflowActions) {
					if (!data_request.dimension) {
						data_request.dimension = {};
					}
					delete data_request.dimension.flags;
					data_request.dimension.flags = callflowFlags;
				}

				var listData = {};
				
				if (self.flow.id) {
					// if main user callflow is being edited from the popup on a user
					if (miscSettings.enableModifyMainUserCallflow && source == 'callflow-managerPopup') {
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
							success: function() {
								callback();
							}
						});
					}
					// if show all callflows is enabled and this is a hidden callflow then retain existing ui_metadata 
					else if (showAllCallflows == true && isHiddenCallflow == true) {
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
								listData.selectedItemId = json.data.id
								self.repaintList(listData);
								self.editCallflow({ id: json.data.id });
							}
						});
					}
					// normal callflow update
					else {
						self.callApi({
							resource: 'callflow.update',
							data: {
								accountId: self.accountId,
								callflowId: self.flow.id,
								data: data_request
							},
							success: function(json) {
								listData.selectedItemId = json.data.id
								self.repaintList(listData);
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
							listData.selectedItemId = json.data.id
							self.repaintList(listData);
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
		},

		checkItemExists: function(data) {

			var self = this,
				resourceGet = data.resource + '.get',
				resourceId = data.resourceId,
				itemList = data.itemList,
				selectedId = data.selectedId,
				callback = data.callback,
				node = data.node || undefined;
				
			self.callApi({
				resource: resourceGet,
				data: {
					accountId: self.accountId,
					[resourceId]: selectedId,
					generateError: false
				},
				success: function(data) {
					var response = data.data,
						responseData = {
							id: response.id,
							name: response.name
						},
						exists = _.find(itemList, { id: responseData.id });
					
					if (!exists) {
						if (resourceId == 'userId') {
							responseData.name = response.first_name + ' ' + response.last_name;
						}

						itemList = itemList || [];
						itemList.push(responseData);
					}
					callback(false);
				},
				error: function() {
					callback(true);
				}
			});

		},

		// open a callflow editor inside a dialog popup
		callflowPopupEdit: function(args) {
			var self       = this,
				data       = args.data || {},
				callflowId = data.id,
				popup_html = $('<div class="callflow-managerPopup"><div class="inline_content main_content"></div></div>'),
				popup;

			self.isUserCallflowPopup = true;

			// build dialog popup
			popup = monster.ui.dialog(popup_html, {
				title: self.i18n.active().callflows.user.user_callflow.popup_title,
				width: '90%',
				create: function() {
					$(this).closest('.ui-dialog-content').addClass('scrollbar-hidden');
				}
			});

			var $inline = popup_html.find('.inline_content');

			self.loadCallflowManager($inline, function() {
				
				self.editCallflow({ id: callflowId });

				self.syncFlowHeight();

				// observe changes inside the popup's flowchart
				var flowchart = $inline.find('.flowchart')[0];
				if (flowchart) {
					var observer = new MutationObserver(function () {
						self.syncFlowHeight();
					});
					observer.observe(flowchart, {
						attributes: true,
						childList: true,
						subtree: true
					});
					popup.data('flowObserver', observer);
				}

				// build callflow popup layout with save botton
				var $existingContent = $inline.children().detach(),
					$body = $('<div class="callflow-body"></div>').append($existingContent),
					$footer = $(
					'<div class="callflow-footer buttons-center">' +
						'<button type="button" class="monster-button monster-button-success save-callflow">' +
							self.i18n.active().callflows.vmbox.save +
						'</button>' +
					'</div>'
				);

				$inline.empty().append($body).append($footer);

			}, 'callflow-managerPopup');

			// clean up the observer when the dialog closes
			popup.on('dialogclose', function () {
				var observer = popup.data('flowObserver');
				if (observer) {
					observer.disconnect();
				}

				self.isUserCallflowPopup = false;
			});

			popup_html.on('click', '.save-callflow', function (e) {
				e.preventDefault();
				self.save({
					source: 'callflow-managerPopup',
					callback() {
						popup.dialog('close');
					}
				});
			});

		},

		// load callflow manager into a given container
		loadCallflowManager: function(container, done, templateName) {
			var self = this,
				callflowsTemplate = $(self.getTemplate({
					name: templateName,
					data: {
						miscSettings: miscSettings
					}
				}));

			self.bindCallflowsEvents(callflowsTemplate, container);

			monster.ui.tooltips(callflowsTemplate);

			container.append(callflowsTemplate);

			self.hackResize(callflowsTemplate);

			// hide scrollbar within callflow designer - previously under setting miscSettings.hideScrollbars
			$('#ws_callflow .tools', callflowsTemplate).addClass('scrollbar-hidden');
			$('#ws_callflow .flowchart', callflowsTemplate).addClass('scrollbar-hidden');

			// enable zoom control
			self.setupZoomControls(callflowsTemplate);
			
			// enable moving around the callflow workspace
			self.enableInfinitePanning();

			done && done();
		},

		// reusable list editor for phone numbers and email addresses
		listEditorBind: function(opts) {
			var self = this,
				$container = opts.container;

			var $placeholder = $container.find('.item-wrapper.placeholder'),
				$input = $container.find('.list-editor-input'),
				$add = $container.find('.list-editor-add'),
				$cancel = $container.find('.list-editor-cancel'),
				$saved = $container.find('.saved-items'),
				$error = $container.find('.list-editor-error');

			var valueType = opts.valueType || null, // 'emailAddress' | 'phoneNumber' | null
				normalize = opts.normalize || function(v) { return (v || '').toString().trim(); },
				unique = opts.unique !== false;

			var validators = {
				emailAddress: function(v) {
					// basic shape: name@example.com
					if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
						return false;
					}
					// no double dots anywhere
					if (/\.\./.test(v)) {
						return false;
					}
					// no leading dot, no trailing dot before @, no domain starting with dot
					if (/^\.|\.@|@\./.test(v)) {
						return false;
					}
					return true;
				},

				// no spaces, brackets, dots or hyphens
				phoneNumber: function(v) {
					return /^\+?\d{6,20}$/.test(v);
				}
			};

			function getValues() {
				var values = [];
				$saved.find('.item-wrapper').each(function() {
					var v = $(this).attr('data-value');
					if (v) values.push(v);
				});
				return values;
			}

			function emitChange() {
				if (typeof opts.onChange === 'function') {
					opts.onChange(getValues());
				}
			}

			function exists(value) {
				var found = false;
				$saved.find('.item-wrapper').each(function() {
					if ($(this).attr('data-value') === value) {
						found = true;
						return false;
					}
				});
				return found;
			}

			function validate(value) {
				if (valueType && validators[valueType]) {
					var ok = validators[valueType](value);

					if (!ok) {
						var msg = opts.invalidMessage || 'Invalid value';
						return { ok: false, message: msg };
					}

					return { ok: true };
				}
				return { ok: !!value };
			}

			function showError(msg) {
				if (!msg) return;
				$error.text(msg).show();
				$input.addClass('monster-invalid');
			}

			function clearError() {
				$error.text('').hide();
				$input.removeClass('monster-invalid');
			}

			function addValue(raw) {
				clearError();

				var value = normalize(raw);
				var v = validate(value);

				if (!v.ok) {
					showError(opts.invalidMessage || 'Invalid value');
					return;
				}

				if (unique && exists(value)) {
					showError(opts.duplicateMessage || 'The entered value already exists');
					return;
				}

				$saved.prepend(opts.getItemHtml(value));
				$input.val('');
				clearError();
				emitChange();
			}

			$placeholder.off('click.listEditor').on('click.listEditor', function() {
				$(this).addClass('active');
				$input.focus();
			});

			$add.off('click.listEditor').on('click.listEditor', function(e) {
				e.preventDefault();
				addValue($input.val());
			});

			$container.find('.add-item').off('keypress.listEditor').on('keypress.listEditor', function(e) {
				var code = e.keyCode || e.which;
				if (code === 13) {
					e.preventDefault();
					addValue($input.val());
				}
			});

			$container.off('click.listEditorDelete', '.list-editor-delete')
			.on('click.listEditorDelete', '.list-editor-delete', function() {
				$(this).closest('.item-wrapper').remove();
				emitChange();
			});

			$input.on('input.listEditor', function() {
				clearError();
			});

			$cancel.off('click.listEditor').on('click.listEditor', function(e) {
				e.stopPropagation();
				$placeholder.removeClass('active');
				$input.val('');
				clearError();
			});

			// Load initial values
			_.each(opts.initial || [], function(v) {
				addValue(v);
			});

			return {
				getValues: getValues,
				setValues: function(values) {
					$saved.empty();
					_.each(values || [], function(v) { addValue(v); });
				},
				clear: function() {
					$saved.empty();
					emitChange();
				},
				setEnabled: function(enabled) {
					$container.toggle(!!enabled);
					if (!enabled) {
						$placeholder.removeClass('active');
						$input.val('');
					}
				}
			};
		}

	};

	return app;
});