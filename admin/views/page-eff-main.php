<?php
/**
 * EFF Admin Page — Root HTML Template
 *
 * Renders the four-panel EFF application layout. This template is included
 * from EFF_Admin::render_admin_page() which sets the $theme variable.
 *
 * Panels:
 *  - Top menu bar (fixed header)
 *  - Left navigation panel (collapsible)
 *  - Center edit space (main working area)
 *  - Right status panel (file management + counts)
 *
 * @package ElementorFrameworkForge
 * @var string $theme 'light' or 'dark'
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Helper: safely inline an SVG icon file.
 *
 * @param string $name Icon filename without .svg extension.
 * @return string SVG markup or empty string if file not found.
 */
function eff_icon( string $name ): string {
	$file = EFF_PLUGIN_DIR . 'assets/icons/' . $name . '.svg';
	if ( file_exists( $file ) ) {
		return file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	}
	return '';
}
?>
<div class="eff-app" data-eff-theme="<?php echo esc_attr( $theme ); ?>" id="eff-app">

	<!-- ================================================================
	     TOP MENU BAR
	     ================================================================ -->
	<header class="eff-top-bar" role="banner">

		<div class="eff-top-bar__left">
			<button class="eff-icon-btn" id="eff-btn-preferences"
			        aria-label="<?php esc_attr_e( 'Preferences', 'elementor-framework-forge' ); ?>"
			        data-eff-tooltip="<?php esc_attr_e( 'Preferences', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'gear' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="eff-icon-btn" id="eff-btn-manage-project"
			        aria-label="<?php esc_attr_e( 'Manage Project', 'elementor-framework-forge' ); ?>"
			        data-eff-tooltip="<?php esc_attr_e( 'Manage Project', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'grid' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
		</div>

		<div class="eff-top-bar__brand">
			<span class="eff-brand-name">Elementor Framework Forge</span>
		</div>

		<div class="eff-top-bar__right">
			<button class="eff-icon-btn" id="eff-btn-export"
			        aria-label="<?php esc_attr_e( 'Export', 'elementor-framework-forge' ); ?>"
			        data-eff-tooltip="<?php esc_attr_e( 'Export', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'export' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="eff-icon-btn" id="eff-btn-import"
			        aria-label="<?php esc_attr_e( 'Import', 'elementor-framework-forge' ); ?>"
			        data-eff-tooltip="<?php esc_attr_e( 'Import', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'import' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="eff-icon-btn" id="eff-btn-sync"
			        aria-label="<?php esc_attr_e( 'Sync from Elementor', 'elementor-framework-forge' ); ?>"
			        data-eff-tooltip="<?php esc_attr_e( 'Sync from Elementor', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'sync' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="eff-icon-btn" id="eff-btn-history"
			        aria-label="<?php esc_attr_e( 'Change History', 'elementor-framework-forge' ); ?>"
			        data-eff-tooltip="<?php esc_attr_e( 'Change History', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'history' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="eff-icon-btn" id="eff-btn-search"
			        aria-label="<?php esc_attr_e( 'Search', 'elementor-framework-forge' ); ?>"
			        data-eff-tooltip="<?php esc_attr_e( 'Search', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'search' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
			<button class="eff-icon-btn" id="eff-btn-help"
			        aria-label="<?php esc_attr_e( 'Help', 'elementor-framework-forge' ); ?>"
			        data-eff-tooltip="<?php esc_attr_e( 'Help', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'help' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>
		</div>

	</header><!-- .eff-top-bar -->

	<!-- ================================================================
	     MAIN WORKSPACE (Left + Center + Right)
	     ================================================================ -->
	<div class="eff-workspace">

		<!-- ============================================================
		     LEFT NAVIGATION PANEL
		     ============================================================ -->
		<aside class="eff-panel-left" id="eff-panel-left" aria-label="<?php esc_attr_e( 'Asset navigation', 'elementor-framework-forge' ); ?>">

			<button class="eff-icon-btn eff-collapse-btn" id="eff-btn-collapse-left"
			        aria-label="<?php esc_attr_e( 'Collapse navigation panel', 'elementor-framework-forge' ); ?>"
			        aria-expanded="true"
			        data-eff-tooltip="<?php esc_attr_e( 'Collapse panel', 'elementor-framework-forge' ); ?>">
				<?php echo eff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
			</button>

			<nav class="eff-nav-tree" role="navigation" aria-label="<?php esc_attr_e( 'Asset navigation', 'elementor-framework-forge' ); ?>">

				<!-- VARIABLES -->
				<div class="eff-nav-group" data-group="variables">
					<button class="eff-nav-group__header"
					        aria-expanded="true"
					        aria-controls="eff-nav-variables">
						<span class="eff-nav-group__icon" aria-hidden="true">
							<?php echo eff_icon( 'variables' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="eff-nav-group__label"><?php esc_html_e( 'Variables', 'elementor-framework-forge' ); ?></span>
						<span class="eff-nav-group__chevron" aria-hidden="true">
							<?php echo eff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>

					<div class="eff-nav-group__children" id="eff-nav-variables">

						<!-- Colors subgroup -->
						<div class="eff-nav-subgroup" data-subgroup="colors">
							<button class="eff-nav-subgroup__header"
							        aria-expanded="true"
							        aria-controls="eff-nav-colors">
								<span class="eff-nav-subgroup__icon" aria-hidden="true">
									<?php echo eff_icon( 'colors' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="eff-nav-subgroup__label"><?php esc_html_e( 'Colors', 'elementor-framework-forge' ); ?></span>
							</button>
							<ul class="eff-nav-items" id="eff-nav-colors" role="list">
								<!-- Dynamically populated from project config -->
							</ul>
						</div>

						<!-- Fonts subgroup -->
						<div class="eff-nav-subgroup" data-subgroup="fonts">
							<button class="eff-nav-subgroup__header"
							        aria-expanded="true"
							        aria-controls="eff-nav-fonts">
								<span class="eff-nav-subgroup__icon" aria-hidden="true">
									<?php echo eff_icon( 'fonts' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="eff-nav-subgroup__label"><?php esc_html_e( 'Fonts', 'elementor-framework-forge' ); ?></span>
							</button>
							<ul class="eff-nav-items" id="eff-nav-fonts" role="list">
								<!-- Dynamically populated from Elementor font registry -->
							</ul>
						</div>

						<!-- Numbers subgroup -->
						<div class="eff-nav-subgroup" data-subgroup="numbers">
							<button class="eff-nav-subgroup__header"
							        aria-expanded="true"
							        aria-controls="eff-nav-numbers">
								<span class="eff-nav-subgroup__icon" aria-hidden="true">
									<?php echo eff_icon( 'numbers' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
								</span>
								<span class="eff-nav-subgroup__label"><?php esc_html_e( 'Numbers', 'elementor-framework-forge' ); ?></span>
							</button>
							<ul class="eff-nav-items" id="eff-nav-numbers" role="list">
								<!-- Dynamically populated from project config -->
							</ul>
						</div>

					</div><!-- #eff-nav-variables -->
				</div><!-- [data-group="variables"] -->

				<!-- CLASSES -->
				<div class="eff-nav-group" data-group="classes">
					<button class="eff-nav-group__header"
					        aria-expanded="false"
					        aria-controls="eff-nav-classes">
						<span class="eff-nav-group__icon" aria-hidden="true">
							<?php echo eff_icon( 'classes' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="eff-nav-group__label"><?php esc_html_e( 'Classes', 'elementor-framework-forge' ); ?></span>
						<span class="eff-nav-group__chevron" aria-hidden="true">
							<?php echo eff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>
					<div class="eff-nav-group__children" id="eff-nav-classes" hidden>
						<p class="eff-nav-coming-soon"><?php esc_html_e( 'Classes support coming in EFF v3.', 'elementor-framework-forge' ); ?></p>
					</div>
				</div>

				<!-- COMPONENTS -->
				<div class="eff-nav-group" data-group="components">
					<button class="eff-nav-group__header"
					        aria-expanded="false"
					        aria-controls="eff-nav-components">
						<span class="eff-nav-group__icon" aria-hidden="true">
							<?php echo eff_icon( 'components' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
						<span class="eff-nav-group__label"><?php esc_html_e( 'Components', 'elementor-framework-forge' ); ?></span>
						<span class="eff-nav-group__chevron" aria-hidden="true">
							<?php echo eff_icon( 'chevron-left' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
						</span>
					</button>
					<div class="eff-nav-group__children" id="eff-nav-components" hidden>
						<p class="eff-nav-coming-soon"><?php esc_html_e( 'Components support coming in EFF v4.', 'elementor-framework-forge' ); ?></p>
					</div>
				</div>

			</nav><!-- .eff-nav-tree -->

		</aside><!-- .eff-panel-left -->

		<!-- ============================================================
		     CENTER EDIT SPACE
		     ============================================================ -->
		<main class="eff-edit-space" id="eff-edit-space" role="main">

			<!-- Placeholder — shown when no category is selected -->
			<div class="eff-placeholder" id="eff-placeholder">
				<span class="eff-placeholder__icon" aria-hidden="true">
					<?php echo eff_icon( 'variables' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				</span>
				<p class="eff-placeholder__text">
					<?php esc_html_e( 'Select a category from the left panel', 'elementor-framework-forge' ); ?>
				</p>
			</div>

			<!-- Content area — hidden until a category is selected -->
			<div class="eff-edit-content" id="eff-edit-content" hidden aria-live="polite"></div>

		</main><!-- .eff-edit-space -->

		<!-- ============================================================
		     RIGHT STATUS PANEL
		     ============================================================ -->
		<aside class="eff-panel-right" id="eff-panel-right"
		       aria-label="<?php esc_attr_e( 'File management and status', 'elementor-framework-forge' ); ?>">

			<!-- File Management -->
			<div class="eff-panel-right__files">
				<label class="eff-field-label" for="eff-filename">
					<?php esc_html_e( 'Storage file', 'elementor-framework-forge' ); ?>
				</label>
				<input type="text"
				       class="eff-field-input"
				       id="eff-filename"
				       name="eff-filename"
				       placeholder="<?php esc_attr_e( 'e.g., my-project.eff.json', 'elementor-framework-forge' ); ?>"
				       autocomplete="off"
				       spellcheck="false" />

				<div class="eff-file-actions">
					<button class="eff-icon-btn" id="eff-btn-load"
					        aria-label="<?php esc_attr_e( 'Load file', 'elementor-framework-forge' ); ?>"
					        data-eff-tooltip="<?php esc_attr_e( 'Load file', 'elementor-framework-forge' ); ?>">
						<?php echo eff_icon( 'folder-open' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</button>
					<button class="eff-icon-btn" id="eff-btn-save"
					        aria-label="<?php esc_attr_e( 'Save file', 'elementor-framework-forge' ); ?>"
					        data-eff-tooltip="<?php esc_attr_e( 'Save file', 'elementor-framework-forge' ); ?>">
						<?php echo eff_icon( 'save' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</button>
					<button class="eff-icon-btn eff-save-changes-btn"
					        id="eff-btn-save-changes"
					        aria-label="<?php esc_attr_e( 'Save changes', 'elementor-framework-forge' ); ?>"
					        data-eff-tooltip="<?php esc_attr_e( 'Save changes', 'elementor-framework-forge' ); ?>"
					        disabled
					        aria-disabled="true">
						<?php echo eff_icon( 'checkmark' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</button>
				</div>
			</div><!-- .eff-panel-right__files -->

			<!-- Counts -->
			<div class="eff-panel-right__counts" aria-label="<?php esc_attr_e( 'Asset counts', 'elementor-framework-forge' ); ?>">

				<div class="eff-count-item">
					<span class="eff-count-item__icon" aria-hidden="true">
						<?php echo eff_icon( 'variables' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</span>
					<span class="eff-count-item__label"><?php esc_html_e( 'Variables', 'elementor-framework-forge' ); ?></span>
					<span class="eff-count-item__value" id="eff-count-variables" aria-live="polite">0</span>
				</div>

				<div class="eff-count-item">
					<span class="eff-count-item__icon" aria-hidden="true">
						<?php echo eff_icon( 'classes' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</span>
					<span class="eff-count-item__label"><?php esc_html_e( 'Classes', 'elementor-framework-forge' ); ?></span>
					<span class="eff-count-item__value" id="eff-count-classes" aria-live="polite">0</span>
				</div>

				<div class="eff-count-item">
					<span class="eff-count-item__icon" aria-hidden="true">
						<?php echo eff_icon( 'components' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
					</span>
					<span class="eff-count-item__label"><?php esc_html_e( 'Components', 'elementor-framework-forge' ); ?></span>
					<span class="eff-count-item__value" id="eff-count-components" aria-live="polite">0</span>
				</div>

			</div><!-- .eff-panel-right__counts -->

		</aside><!-- .eff-panel-right -->

	</div><!-- .eff-workspace -->

	<!-- ================================================================
	     MODAL SYSTEM (single instance, content swapped by JS)
	     ================================================================ -->
	<div class="eff-modal-overlay" id="eff-modal-overlay" aria-hidden="true">
		<div class="eff-modal"
		     id="eff-modal"
		     role="dialog"
		     aria-modal="true"
		     aria-labelledby="eff-modal-title">

			<div class="eff-modal__header">
				<h2 class="eff-modal__title" id="eff-modal-title"></h2>
				<button class="eff-icon-btn eff-modal__close"
				        id="eff-modal-close"
				        aria-label="<?php esc_attr_e( 'Close modal', 'elementor-framework-forge' ); ?>">
					<?php echo eff_icon( 'close' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
				</button>
			</div>

			<div class="eff-modal__body" id="eff-modal-body"></div>
			<div class="eff-modal__footer" id="eff-modal-footer"></div>

		</div><!-- .eff-modal -->
	</div><!-- .eff-modal-overlay -->

	<!-- ================================================================
	     TOOLTIP (single instance, positioned by JS)
	     ================================================================ -->
	<div class="eff-tooltip" id="eff-tooltip" role="tooltip" aria-hidden="true"></div>

</div><!-- .eff-app -->
