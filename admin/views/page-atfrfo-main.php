<?php
/**
 * ATFRFO Admin Page — Root HTML Template
 *
 * Renders the four-panel ATFRFO application layout. This template is included
 * from ATFRFO_Admin::render_admin_page() which sets the $theme variable.
 *
 * Panels:
 *  - Top menu bar (fixed header)
 *  - Left navigation panel (collapsible)
 *  - Center edit space (main working area)
 *  - Right status panel (file management + counts)
 *
 * @package AtomicFrameworkForge
 * @var string $theme            'light' or 'dark'
 * @var bool   $show_notify_sign Whether the "take a look" notify sign has not yet
 *                                reached its display cap for the current user.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Template helper: echoes an icon's SVG markup, escaped at this — the
 * actual output — point via wp_kses(), not just upstream in get_icon().
 *
 * @param string $name Icon filename without .svg extension.
 */
function atfrfo_icon( string $name ): void {
	echo wp_kses( ATFRFO_Admin::get_icon( $name ), ATFRFO_Admin::get_icon_allowed_tags() );
}
?>
<!-- Mobile restriction overlay — shown below 1024px -->
<div class="atfrfo-mobile-block" aria-live="polite">
	<p class="atfrfo-mobile-block__message">
		<?php esc_html_e( 'Atomic Framework Forge for Elementor requires a desktop browser. Please open this page on a device with a screen width of at least 1024px.', 'atomic-framework-forge-for-elementor' ); ?>
	</p>
</div>

<div class="atfrfo-app" data-atfrfo-theme="<?php echo esc_attr( $theme ); ?>" id="atfrfo-app">

	<?php if ( $show_notify_sign ) : ?>
	<!-- "Take a look" notify sign — rises from bottom-left corner once per
	     page load, up to ATFRFO_NOTIFY_MAX_SHOWS times per user (see ATFRFO.Notify). -->
	<img src="<?php echo esc_url( ATFRFO_PLUGIN_URL . 'assets/images/take-a-look.png' ); ?>"
	     class="atfrfo-notify-sign"
	     id="atfrfo-notify-sign"
	     alt="<?php esc_attr_e( 'New? Take a look at our Quick-Start manual.', 'atomic-framework-forge-for-elementor' ); ?>" />
	<?php endif; ?>

	<!-- ================================================================
	     TOP MENU BAR
	     ================================================================ -->
	<header class="atfrfo-top-bar" role="banner">

		<!-- Logo + title -->
		<div class="atfrfo-top-bar__brand">
			<img src="<?php echo esc_url( ATFRFO_PLUGIN_URL . 'assets/logo/logo.png' ); ?>"
			     class="atfrfo-logo" alt="JimRForge" />
			<span class="atfrfo-brand-name">Atomic Framework Forge</span>
		</div>

		<!-- Editable project name -->
		<div class="atfrfo-top-bar__project">
			<span class="atfrfo-project-label"><?php esc_html_e( 'Project:', 'atomic-framework-forge-for-elementor' ); ?></span>
			<input type="text"
			       class="atfrfo-project-input"
			       id="atfrfo-filename"
			       name="atfrfo-filename"
			       placeholder="<?php esc_attr_e( 'Project name', 'atomic-framework-forge-for-elementor' ); ?>"
			       autocomplete="off"
			       spellcheck="false" />
		</div>

		<!-- Project-scoped actions — every function gets its own icon now
		     (2026-09-02, per Jim's request); the "More" dropdown to the right
		     is no longer where less-common items hide, it's a full icon+label
		     mirror of everything here (same groups, same order) for anyone who
		     wants text instead of an icon to hover-guess. Four functional
		     groups, separated by the existing vertical-line separators:
		     Project (this project's identity/container — name/config,
		     switching projects, history, and app preferences), Data
		     (moving the current dataset somewhere), Tools (operating on
		     the data), and App (Print/Help — not project-specific). -->
		<div class="atfrfo-top-bar__actions">

			<!-- GROUP: Project -->
			<button class="atfrfo-icon-btn" id="atfrfo-btn-project-settings"
			        aria-label="<?php esc_attr_e( 'Project Settings', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Project Settings', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Project Settings — this project\'s name and its Colors / Fonts / Numbers category lists', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'grid' ); ?>
			</button>
			<button class="atfrfo-icon-btn" id="atfrfo-btn-project-manager"
			        aria-label="<?php esc_attr_e( 'Project Manager', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Project Manager', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Project Manager — open, create, rename, copy, or delete projects and restore from backups', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'folder-open' ); ?>
			</button>
			<!-- Change History button (#atfrfo-btn-history) hidden until the
			     feature exists — it only opened a "planned for a future
			     release" notice. Handler _openHistory() is kept in
			     atfrfo-panel-top.js; restore this button and its More-menu
			     mirror together when the feature ships. -->
			<button class="atfrfo-icon-btn" id="atfrfo-btn-preferences"
			        aria-label="<?php esc_attr_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Preferences — app-wide display and behavior settings', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'gear' ); ?>
			</button>

			<span class="atfrfo-toolbar-sep" aria-hidden="true"></span>

			<!-- GROUP: Data -->
			<button class="atfrfo-icon-btn" id="atfrfo-btn-sync"
			        aria-label="<?php esc_attr_e( 'Sync with Elementor', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Sync', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Sync — import variables from Elementor or export ATFRFO data back to Elementor (V3 and V4). Reads and writes your live site.', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'sync' ); ?>
			</button>
			<button class="atfrfo-icon-btn atfrfo-icon-btn--save-slot" id="atfrfo-btn-save-changes"
			        aria-label="<?php esc_attr_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Save Changes — updates the current project file in place, on this server', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'save' ); ?>
			</button>
			<button class="atfrfo-icon-btn" id="atfrfo-btn-export-import"
			        aria-label="<?php esc_attr_e( 'Export or Import a project file', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Export / Import', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Export / Import — save or load a project file on your computer, in AFF, Elementor v4, Bricks, or Figma format. Does not touch your live site.', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'export' ); ?>
			</button>

			<span class="atfrfo-toolbar-sep" aria-hidden="true"></span>

			<!-- GROUP: Tools — was a dropdown (Change Variable Types + Diagnose
			     & Clean Up); Change Variable Types removed 2026-09-02 (it was
			     a "Coming in a future release" stub, not a real feature — see
			     Jim's request), which left only one real item, so this is now
			     a direct button instead of a one-item dropdown. -->
			<button class="atfrfo-icon-btn" id="atfrfo-btn-functions"
			        aria-label="<?php esc_attr_e( 'Diagnose &amp; Clean Up', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Diagnose &amp; Clean Up', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Diagnose &amp; Clean Up — find and remove duplicate variables or categories', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'function' ); ?>
			</button>

			<!-- GROUP: App (no separator before this — merged with Tools per Jim's request) -->
			<button class="atfrfo-icon-btn" id="atfrfo-btn-print"
			        aria-label="<?php esc_attr_e( 'Print / PDF', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Print / PDF', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Print / PDF — generate a printable summary of this project', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'print' ); ?>
			</button>
			<button class="atfrfo-icon-btn" id="atfrfo-btn-help"
			        aria-label="<?php esc_attr_e( 'Help', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Help', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Help — quick-start guide and reference', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php atfrfo_icon( 'help' ); ?>
			</button>

			<span class="atfrfo-toolbar-sep" aria-hidden="true"></span>

			<!-- "More" — full icon+label mirror of every button above, same
			     four groups in the same order, for anyone who wants a labeled
			     list instead of hover-guessing icons. Each item triggers the
			     exact same action as its top-bar counterpart (see
			     atfrfo-panel-top.js _bindButtons — both ids are bound to the
			     same handler function, not two separate implementations). -->
			<div class="atfrfo-dropdown-wrap" id="atfrfo-dropdown-wrap-more">
				<button class="atfrfo-icon-btn" id="atfrfo-btn-more"
				        aria-label="<?php esc_attr_e( 'All actions (with labels)', 'atomic-framework-forge-for-elementor' ); ?>"
				        aria-haspopup="true"
				        aria-expanded="false"
				        data-atfrfo-tooltip="<?php esc_attr_e( 'All Actions', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-atfrfo-tooltip-long="<?php esc_attr_e( 'All Actions — the same buttons as the toolbar, with labels', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php atfrfo_icon( 'more' ); ?>
				</button>
				<ul class="atfrfo-dropdown" id="atfrfo-dropdown-more" role="menu" aria-labelledby="atfrfo-btn-more">
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-project-settings" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'grid' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Project Settings', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-project-manager" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'folder-open' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Project Manager', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-preferences" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'gear' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>

					<li class="atfrfo-dropdown__divider" role="separator" aria-hidden="true"></li>

					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-sync" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'sync' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Sync', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-save-changes" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'save' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-export-import" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'export' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Export / Import', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>

					<li class="atfrfo-dropdown__divider" role="separator" aria-hidden="true"></li>

					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-functions" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'function' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Diagnose &amp; Clean Up', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>

					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-print" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'print' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Print / PDF', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-menu-help" role="menuitem">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php atfrfo_icon( 'help' ); ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Help', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
				</ul>
			</div>

		</div>

	</header><!-- .atfrfo-top-bar -->

	<!-- ================================================================
	     MAIN WORKSPACE (Left + Center + Right)
	     ================================================================ -->
	<div class="atfrfo-workspace" id="atfrfo-workspace">

		<!-- ============================================================
		     LEFT NAVIGATION PANEL
		     ============================================================ -->
		<aside class="atfrfo-panel-left" id="atfrfo-panel-left" aria-label="<?php esc_attr_e( 'Asset navigation', 'atomic-framework-forge-for-elementor' ); ?>">

			<button class="atfrfo-icon-btn atfrfo-collapse-btn" id="atfrfo-btn-collapse-left"
			        aria-label="<?php esc_attr_e( 'Collapse navigation panel', 'atomic-framework-forge-for-elementor' ); ?>"
			        aria-expanded="true"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Collapse panel', 'atomic-framework-forge-for-elementor' ); ?>">
				<span class="atfrfo-collapse-arrow" aria-hidden="true">&#8592;</span>
			</button>

			<nav class="atfrfo-nav-tree" role="navigation" aria-label="<?php esc_attr_e( 'Asset navigation', 'atomic-framework-forge-for-elementor' ); ?>">

				<!-- VARIABLES -->
				<div class="atfrfo-nav-group" data-group="variables">
					<button class="atfrfo-nav-group__header"
					        aria-expanded="false"
					        aria-controls="atfrfo-nav-variables"
					        data-atfrfo-tooltip="<?php esc_attr_e( 'Variables — CSS custom properties: Colors, Fonts, Numbers', 'atomic-framework-forge-for-elementor' ); ?>">
						<span class="atfrfo-nav-group__icon" aria-hidden="true">
							<?php atfrfo_icon( 'variables' ); ?>
						</span>
						<span class="atfrfo-nav-group__label"><?php esc_html_e( 'Variables', 'atomic-framework-forge-for-elementor' ); ?></span>
						<span class="atfrfo-nav-group__chevron" aria-hidden="true">
							<?php echo atfrfo_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>

					<div class="atfrfo-nav-group__children" id="atfrfo-nav-variables" hidden>

						<!-- Colors subgroup -->
						<div class="atfrfo-nav-subgroup" data-subgroup="colors">
							<button class="atfrfo-nav-subgroup__header"
							        aria-expanded="false"
							        aria-controls="atfrfo-nav-colors">
								<span class="atfrfo-nav-subgroup__icon" aria-hidden="true">
									<?php atfrfo_icon( 'colors' ); ?>
								</span>
								<span class="atfrfo-nav-subgroup__label"><?php esc_html_e( 'Colors', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="atfrfo-nav-items" id="atfrfo-nav-colors" role="list" hidden>
								<!-- Dynamically populated from project config -->
							</ul>
						</div>

						<!-- Fonts subgroup -->
						<div class="atfrfo-nav-subgroup" data-subgroup="fonts">
							<button class="atfrfo-nav-subgroup__header"
							        aria-expanded="false"
							        aria-controls="atfrfo-nav-fonts">
								<span class="atfrfo-nav-subgroup__icon" aria-hidden="true">
									<?php atfrfo_icon( 'fonts' ); ?>
								</span>
								<span class="atfrfo-nav-subgroup__label"><?php esc_html_e( 'Fonts', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="atfrfo-nav-items" id="atfrfo-nav-fonts" role="list" hidden>
								<!-- Dynamically populated from Elementor font registry -->
							</ul>
						</div>

						<!-- Numbers subgroup -->
						<div class="atfrfo-nav-subgroup" data-subgroup="numbers">
							<button class="atfrfo-nav-subgroup__header"
							        aria-expanded="false"
							        aria-controls="atfrfo-nav-numbers">
								<span class="atfrfo-nav-subgroup__icon" aria-hidden="true">
									<?php atfrfo_icon( 'numbers' ); ?>
								</span>
								<span class="atfrfo-nav-subgroup__label"><?php esc_html_e( 'Numbers', 'atomic-framework-forge-for-elementor' ); ?></span>
							</button>
							<ul class="atfrfo-nav-items" id="atfrfo-nav-numbers" role="list" hidden>
								<!-- Dynamically populated from project config -->
							</ul>
						</div>

					</div><!-- #atfrfo-nav-variables -->
				</div><!-- [data-group="variables"] -->

				<!-- CLASSES -->
				<div class="atfrfo-nav-group" data-group="classes">
					<button class="atfrfo-nav-group__header"
					        aria-expanded="false"
					        aria-controls="atfrfo-nav-classes"
					        data-atfrfo-tooltip="<?php esc_attr_e( 'Classes — CSS class management (coming in ATFRFO v3)', 'atomic-framework-forge-for-elementor' ); ?>">
						<span class="atfrfo-nav-group__icon" aria-hidden="true">
							<?php atfrfo_icon( 'classes' ); ?>
						</span>
						<span class="atfrfo-nav-group__label"><?php esc_html_e( 'Classes', 'atomic-framework-forge-for-elementor' ); ?></span>
						<span class="atfrfo-nav-group__chevron" aria-hidden="true">
							<?php echo atfrfo_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>
					<div class="atfrfo-nav-group__children" id="atfrfo-nav-classes" hidden>
						<p class="atfrfo-nav-coming-soon"><?php esc_html_e( 'Classes support coming in ATFRFO v3.', 'atomic-framework-forge-for-elementor' ); ?></p>
					</div>
				</div>

				<!-- COMPONENTS -->
				<div class="atfrfo-nav-group" data-group="components">
					<button class="atfrfo-nav-group__header"
					        aria-expanded="false"
					        aria-controls="atfrfo-nav-components"
					        data-atfrfo-tooltip="<?php esc_attr_e( 'Components — widget composition registry (coming in ATFRFO v4)', 'atomic-framework-forge-for-elementor' ); ?>">
						<span class="atfrfo-nav-group__icon" aria-hidden="true">
							<?php atfrfo_icon( 'components' ); ?>
						</span>
						<span class="atfrfo-nav-group__label"><?php esc_html_e( 'Components', 'atomic-framework-forge-for-elementor' ); ?></span>
						<span class="atfrfo-nav-group__chevron" aria-hidden="true">
							<?php echo atfrfo_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>
					<div class="atfrfo-nav-group__children" id="atfrfo-nav-components" hidden>
						<p class="atfrfo-nav-coming-soon"><?php esc_html_e( 'Components support coming in ATFRFO v4.', 'atomic-framework-forge-for-elementor' ); ?></p>
					</div>
				</div>

			</nav><!-- .atfrfo-nav-tree -->

			<!-- Version number — pinned to bottom of left panel -->
			<div class="atfrfo-panel-version" aria-label="<?php esc_attr_e( 'Plugin version', 'atomic-framework-forge-for-elementor' ); ?>">
				v<?php echo esc_html( ATFRFO_VERSION ); ?>
			</div>

		</aside><!-- .atfrfo-panel-left -->

		<!-- ============================================================
		     CENTER EDIT SPACE
		     ============================================================ -->
		<main class="atfrfo-edit-space" id="atfrfo-edit-space" role="main">

			<!-- Placeholder — shown when no category is selected -->
			<div class="atfrfo-placeholder" id="atfrfo-placeholder">
				<img class="atfrfo-placeholder-banner"
				     src="<?php echo esc_url( ATFRFO_PLUGIN_URL . 'assets/images/banner-jimr-forge.png' ); ?>"
				     alt="<?php esc_attr_e( 'Atomic Framework Forge for Elementor', 'atomic-framework-forge-for-elementor' ); ?>">
			</div>

			<!-- Content area — hidden until a category is selected -->
			<div class="atfrfo-edit-content" id="atfrfo-edit-content" hidden aria-live="polite"></div>

		</main><!-- .atfrfo-edit-space -->

	</div><!-- .atfrfo-workspace -->

	<!-- ================================================================
	     MODAL SYSTEM (single instance, content swapped by JS)
	     ================================================================ -->
	<div class="atfrfo-modal-overlay" id="atfrfo-modal-overlay" aria-hidden="true">
		<div class="atfrfo-modal"
		     id="atfrfo-modal"
		     role="dialog"
		     aria-modal="true"
		     aria-labelledby="atfrfo-modal-title">

			<div class="atfrfo-modal__header">
				<h2 class="atfrfo-modal__title" id="atfrfo-modal-title"></h2>
				<button class="atfrfo-icon-btn atfrfo-modal__close"
				        id="atfrfo-modal-close"
				        aria-label="<?php esc_attr_e( 'Close modal', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php atfrfo_icon( 'close' ); ?>
				</button>
			</div>

			<div class="atfrfo-modal__body" id="atfrfo-modal-body"></div>
			<div class="atfrfo-modal__footer" id="atfrfo-modal-footer"></div>

		</div><!-- .atfrfo-modal -->
	</div><!-- .atfrfo-modal-overlay -->

	<!-- ================================================================
	     TOOLTIP (single instance, positioned by JS)
	     ================================================================ -->
	<div class="atfrfo-tooltip" id="atfrfo-tooltip" role="tooltip" aria-hidden="true"></div>

</div><!-- .atfrfo-app -->
