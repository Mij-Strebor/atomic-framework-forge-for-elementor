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
 * Template helper: proxy to ATFRFO_Admin::get_icon().
 *
 * @param string $name Icon filename without .svg extension.
 * @return string SVG markup or empty string if file not found.
 */
function atfrfo_icon( string $name ): string {
	return ATFRFO_Admin::get_icon( $name );
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

		<!-- Project-scoped actions -->
		<div class="atfrfo-top-bar__actions">

			<button class="atfrfo-icon-btn" id="atfrfo-btn-manage-project"
			        aria-label="<?php esc_attr_e( 'Manage Projects', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Manage Projects', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Manage Projects — open, create, rename, copy, or delete projects and restore from backups', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo atfrfo_icon( 'grid' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>

			<span class="atfrfo-toolbar-sep" aria-hidden="true"></span>

			<button class="atfrfo-icon-btn atfrfo-icon-btn--save-slot" id="atfrfo-btn-save-changes"
			        aria-label="<?php esc_attr_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Save Changes', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Save Changes — updates the current project file in place', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo atfrfo_icon( 'save' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="atfrfo-icon-btn" id="atfrfo-btn-history"
			        aria-label="<?php esc_attr_e( 'Change History', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Change History', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo atfrfo_icon( 'history' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>

			<span class="atfrfo-toolbar-sep" aria-hidden="true"></span>

			<button class="atfrfo-icon-btn" id="atfrfo-btn-sync"
			        aria-label="<?php esc_attr_e( 'Sync with Elementor', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip="<?php esc_attr_e( 'Sync', 'atomic-framework-forge-for-elementor' ); ?>"
			        data-atfrfo-tooltip-long="<?php esc_attr_e( 'Sync — import variables from Elementor or export ATFRFO data back to Elementor (V3 and V4)', 'atomic-framework-forge-for-elementor' ); ?>">
				<?php echo atfrfo_icon( 'sync' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>

			<span class="atfrfo-toolbar-sep" aria-hidden="true"></span>

			<!-- More — infrequent / backup-ish actions: Print, Export, Import -->
			<div class="atfrfo-dropdown-wrap" id="atfrfo-dropdown-wrap-more">
				<button class="atfrfo-icon-btn" id="atfrfo-btn-more"
				        aria-label="<?php esc_attr_e( 'More actions', 'atomic-framework-forge-for-elementor' ); ?>"
				        aria-haspopup="true"
				        aria-expanded="false"
				        data-atfrfo-tooltip="<?php esc_attr_e( 'More', 'atomic-framework-forge-for-elementor' ); ?>"
				        data-atfrfo-tooltip-long="<?php esc_attr_e( 'More — print, export, and import actions', 'atomic-framework-forge-for-elementor' ); ?>">
					<?php echo atfrfo_icon( 'more' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				</button>
				<ul class="atfrfo-dropdown" id="atfrfo-dropdown-more" role="menu" aria-labelledby="atfrfo-btn-more">
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-btn-preferences" role="menuitem"
						        aria-label="<?php esc_attr_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?>">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php echo atfrfo_icon( 'gear' ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Preferences', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li class="atfrfo-dropdown-wrap" id="atfrfo-dropdown-wrap-functions" role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-btn-functions" role="menuitem"
						        aria-haspopup="true"
						        aria-expanded="false"
						        aria-label="<?php esc_attr_e( 'Functions', 'atomic-framework-forge-for-elementor' ); ?>">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php echo atfrfo_icon( 'function' ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Functions', 'atomic-framework-forge-for-elementor' ); ?></span>
							<span class="atfrfo-dropdown__icon atfrfo-dropdown__submenu-arrow" aria-hidden="true"><?php echo atfrfo_icon( 'chevron-right' ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span>
						</button>
						<ul class="atfrfo-dropdown atfrfo-dropdown--nested" id="atfrfo-dropdown-functions" role="menu" aria-labelledby="atfrfo-btn-functions">
							<li class="atfrfo-dropdown__item" data-action="change-types" role="menuitem">
								<?php esc_html_e( 'Change Variable Types', 'atomic-framework-forge-for-elementor' ); ?>
								<span class="atfrfo-badge atfrfo-badge--soon"><?php esc_html_e( 'Soon', 'atomic-framework-forge-for-elementor' ); ?></span>
							</li>
							<li class="atfrfo-dropdown__item" data-action="diagnose" role="menuitem">
								<?php esc_html_e( 'Diagnose &amp; Clean Up', 'atomic-framework-forge-for-elementor' ); ?>
							</li>
						</ul>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-btn-print" role="menuitem"
						        aria-label="<?php esc_attr_e( 'Print / PDF', 'atomic-framework-forge-for-elementor' ); ?>">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php echo atfrfo_icon( 'print' ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Print / PDF', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-btn-export" role="menuitem"
						        aria-label="<?php esc_attr_e( 'Export project as .atfrfo.json', 'atomic-framework-forge-for-elementor' ); ?>">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php echo atfrfo_icon( 'export' ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Export', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-btn-import" role="menuitem"
						        aria-label="<?php esc_attr_e( 'Import project from .atfrfo.json', 'atomic-framework-forge-for-elementor' ); ?>">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php echo atfrfo_icon( 'import' ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span>
							<span class="atfrfo-dropdown__label"><?php esc_html_e( 'Import', 'atomic-framework-forge-for-elementor' ); ?></span>
						</button>
					</li>
					<li role="none">
						<button class="atfrfo-dropdown__item" id="atfrfo-btn-help" role="menuitem"
						        aria-label="<?php esc_attr_e( 'Help', 'atomic-framework-forge-for-elementor' ); ?>">
							<span class="atfrfo-dropdown__icon" aria-hidden="true"><?php echo atfrfo_icon( 'help' ); // phpcs:ignore WordPress.Security.EscapeOutput ?></span>
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
							<?php echo atfrfo_icon( 'variables' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="atfrfo-nav-group__label"><?php esc_html_e( 'Variables', 'atomic-framework-forge-for-elementor' ); ?></span>
					</button>

					<div class="atfrfo-nav-group__children" id="atfrfo-nav-variables" hidden>

						<!-- Colors subgroup -->
						<div class="atfrfo-nav-subgroup" data-subgroup="colors">
							<button class="atfrfo-nav-subgroup__header"
							        aria-expanded="false"
							        aria-controls="atfrfo-nav-colors">
								<span class="atfrfo-nav-subgroup__icon" aria-hidden="true">
									<?php echo atfrfo_icon( 'colors' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
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
									<?php echo atfrfo_icon( 'fonts' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
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
									<?php echo atfrfo_icon( 'numbers' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
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
					        data-atfrfo-tooltip="<?php esc_attr_e( 'Classes — Elementor V4 Global Classes', 'atomic-framework-forge-for-elementor' ); ?>">
						<span class="atfrfo-nav-group__icon" aria-hidden="true">
							<?php echo atfrfo_icon( 'classes' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="atfrfo-nav-group__label"><?php esc_html_e( 'Classes', 'atomic-framework-forge-for-elementor' ); ?></span>
					</button>
					<div class="atfrfo-nav-group__children" id="atfrfo-nav-classes" hidden>
						<ul class="atfrfo-nav-items" id="atfrfo-nav-classes-items" role="list">
							<!-- Dynamically populated from config.classCategories -->
						</ul>
					</div>
				</div>

				<!-- COMPONENTS -->
				<div class="atfrfo-nav-group" data-group="components">
					<button class="atfrfo-nav-group__header"
					        aria-expanded="false"
					        aria-controls="atfrfo-nav-components"
					        data-atfrfo-tooltip="<?php esc_attr_e( 'Components — widget composition registry (coming in ATFRFO v4)', 'atomic-framework-forge-for-elementor' ); ?>">
						<span class="atfrfo-nav-group__icon" aria-hidden="true">
							<?php echo atfrfo_icon( 'components' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="atfrfo-nav-group__label"><?php esc_html_e( 'Components', 'atomic-framework-forge-for-elementor' ); ?></span>
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
					<?php echo atfrfo_icon( 'close' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
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
