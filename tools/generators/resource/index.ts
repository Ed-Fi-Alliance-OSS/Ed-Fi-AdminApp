import { faker } from '@faker-js/faker';
import {
  formatFiles,
  generateFiles,
  getProjects,
  names,
  Tree,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import path from 'path';
import { ScriptKind } from 'typescript';
import { ResourceSchema } from './schema';

export default async function (tree: Tree, schema: ResourceSchema) {
  const projects = getProjects(tree);
  const modelsProject = projects.get('models');
  const apiProject = projects.get('api');
  const feProject = projects.get('fe');

  const models = modelsProject?.sourceRoot!;
  const api = apiProject?.sourceRoot!;
  const fe = feProject?.sourceRoot!;

  const templates = path.join('tools', 'generators', 'resource', 'templates');

  const resourceNames = names(schema.name);

  const sub = {
    tmpl: '',
    ...resourceNames,
  };

  // generate new files
  if (schema.modelFiles) {
    generateFiles(
      tree,
      path.join(templates, 'interface'),
      path.join(models, 'interfaces'),
      sub
    );
    generateFiles(
      tree,
      path.join(templates, 'entity'),
      path.join(models, 'entities'),
      sub
    );
    generateFiles(
      tree,
      path.join(templates, 'dto-consolidated'),
      path.join(models, 'dtos'),
      sub
    );

    // update dto index.ts
    const dtoIndexPath = path.join(models, 'dtos', 'index.ts');
    tree.write(
      dtoIndexPath,
      tree
        .read(dtoIndexPath)!
        .toString()
        .replace(
          /\n$/,
          [
            '',
            `export * from './${resourceNames.fileName}.dto'`,
            '',
          ].join('\n')
        )
    );

    // update entity index.ts
    const entityIndexPath = path.join(models, 'entities', 'index.ts');
    tree.write(
      entityIndexPath,
      tree
        .read(entityIndexPath)!
        .toString()
        .replace(
          /\n$/,
          ['', `export * from './${resourceNames.fileName}.entity'`, ''].join(
            '\n'
          )
        )
    );
    // update interface index.ts
    const interfaceIndexPath = path.join(models, 'interfaces', 'index.ts');
    tree.write(
      interfaceIndexPath,
      tree
        .read(interfaceIndexPath)!
        .toString()
        .replace(
          /\n$/,
          ['', `export * from './${resourceNames.fileName}.interface'`, ''].join(
            '\n'
          )
        )
    );
  }
  if (schema.apiFiles) {
    generateFiles(
      tree,
      path.join(templates, 'api-tenant-routes'),
      path.join(api, resourceNames.fileName + 's'),
      sub
    );
  }
  if (schema.pageFiles) {
    generateFiles(
      tree,
      path.join(templates, 'page'),
      path.join(fe, 'app', 'Pages', resourceNames.className),
      sub
    );
  }
  if (schema.queryFiles) {
    generateFiles(
      tree,
      path.join(templates, 'query'),
      path.join(fe, 'app', 'api', 'queries'),
      sub
    );
    const queryIndexPath = path.join(fe, 'app', 'api', 'queries', 'index.ts');
    tree.write(
      queryIndexPath,
      tree
        .read(queryIndexPath)!
        .toString()
        .replace(
          /\n?$/,
          `\nexport * from './${resourceNames.fileName}.queries'\n`
        )
    );
  }
  if (schema.routeFiles) {
    generateFiles(
      tree,
      path.join(templates, 'route'),
      path.join(fe, 'app', 'routes'),
      sub
    );
  }
  if (schema.useRouteFiles) {
    // update app routes
    const routesPath = path.join(fe, 'app', 'routes', 'index.tsx')!;
    let routes = tree.read(routesPath)!.toString();

    // import routes
    routes = routes.replace(
      /^/,
      `import {
        ${resourceNames.propertyName}Route,
        ${resourceNames.propertyName}sRoute,
        ${resourceNames.propertyName}sIndexRoute,
        ${resourceNames.propertyName}IndexRoute,
      } from './${resourceNames.fileName}.routes';\n`
    );
    routes = routes.replace(
      /^export/m,
      `export * from './${resourceNames.fileName}.routes';\nexport`
    );

    // add routes
    const newRouteTree = `
    ${resourceNames.propertyName}sRoute.addChildren([
      ${resourceNames.propertyName}sIndexRoute,
      ${resourceNames.propertyName}Route.addChildren([
        ${resourceNames.propertyName}IndexRoute,
      ])
    ])`;
    routes = tsquery.replace(
      routes,
      `CallExpression:has(PropertyAccessExpression:has(Identifier[name=addChildren]))
        Identifier[name=indexRoute]`,
      () => {
        return `indexRoute,${newRouteTree}`;
      },
      { visitAllChildren: true }
    );
    tree.write(routesPath, routes);
  }
  if (schema.addToNav) {
    // add to nav
    const randomNavIcon = faker.helpers.arrayElement([
      'BsCloudRain',
      'BsDatabase',
      'BsGear',
      'BsPerson',
      'BsClipboard',
    ]);

    const navPath = path.join(fe, 'app', 'Layout', 'Nav.tsx');
    let nav = tree.read(navPath)!.toString();

    nav = tsquery.replace(
      nav,
      `ImportDeclaration:has(StringLiteral[value="../routes"])
          NamedImports`,
      (node) => {
        return node
          .getText()
          .replace(/,?\s*?\}$/, `, ${resourceNames.propertyName}sRoute}`);
      }
    );


    const ast = tsquery.ast(nav, undefined, ScriptKind.TSX);
    const iconAlreadyImported =
      tsquery.query(
        ast,
        `ImportDeclaration:has(StringLiteral[value=react-icons/bs])
        Identifier[name=${randomNavIcon}]`,
        { visitAllChildren: true }
      ).length > 0;

    if (!iconAlreadyImported) {
      nav = nav.replace(
        /^/,
        `import {
          ${randomNavIcon},
          ${randomNavIcon}Fill,
        } from 'react-icons/bs';`
      );
    }

    const navItems = tsquery
      .query(
        ast,
        `Identifier[name=items]
        ~ ArrayLiteralExpression`,
        { visitAllChildren: true }
      )[0]
      .getText();
    const newNavItems = navItems.replace(
      /,?\s*?\]$/,
      `,
    {
      route: ${resourceNames.propertyName}sRoute,
      icon: ${randomNavIcon},
      activeIcon: ${randomNavIcon}Fill,
      text: '${resourceNames.className}s',
    }
  ]`
    );
    nav = nav.replace(navItems, newNavItems);
    tree.write(navPath, nav);
  }

  if (schema.useApiFiles) {
    const routesPath = path.join(api, 'app', 'routes.ts');
    let routes = tree.read(routesPath)!.toString();
    routes = tsquery.replace(
      routes,
      `VariableDeclaration:has(Identifier[name=routes]) >
        ArrayLiteralExpression`,
      (node) => {
        return node
          .getText()
          .replace(/,?\s*?\]$/, `,\n{
            path: '${resourceNames.fileName}s',
            module: ${resourceNames.className}sModule
          }
        ]`);
      }
    )
    routes = routes.replace(
      /^/,
      `import { ${resourceNames.className}sModule } from '../${resourceNames.fileName}s/${resourceNames.fileName}s.module'\n`
    );
    tree.write(routesPath, routes)


    // update typeorm config
    const typeormConfigPath = path.join(api, 'database', 'typeorm.config.ts');
    let typeormConfig = tree.read(typeormConfigPath)!.toString();

    // add entity
    typeormConfig = tsquery.replace(
      tree.read(typeormConfigPath)!.toString(),
      `TypeReference:has(Identifier[name="DataSourceOptions"])
        ~ ObjectLiteralExpression
          Identifier[name="entities"]
            ~ ArrayLiteralExpression`,
      (node) => {
        return node
          .getText()
          .replace(/,?\s*?\]$/, `, ${resourceNames.className}]`);
      },
      { visitAllChildren: true }
    );

    // import entity
    typeormConfig = tsquery.replace(
      typeormConfig,
      `ImportDeclaration:has(StringLiteral[value="@edanalytics/models"])
          NamedImports`,
      (node) => {
        return node
          .getText()
          .replace(/,?\s*?\}$/, `, ${resourceNames.className}}`);
      }
    );
    tree.write(typeormConfigPath, typeormConfig);

    // update api app module
    const appModulePath = path.join(api, 'app', 'app.module.ts');
    let appModule = tree.read(appModulePath)!.toString();

    // import module
    appModule = appModule.replace(
      /^/,
      `import { ${resourceNames.className}sModule } from '../${resourceNames.fileName}s/${resourceNames.fileName}s.module'\n`
    );

    // add module to app
    appModule = tsquery.replace(
      appModule,
      `PropertyAssignment Identifier[name="imports"]
      ~ ArrayLiteralExpression`,
      (node) => {
        return node
          .getText()
          .replace(/,?\s*?\]$/, `,\n${resourceNames.className}sModule\n]`);
      },
      { visitAllChildren: true }
    );
    tree.write(appModulePath, appModule);
  }

  if (schema.generateFakes) {
    const populatePath = path.join(api, 'database', 'demo-populate.ts');
    let populate = tree.read(populatePath)!.toString();
    populate = tsquery.replace(
      populate,
      `ImportDeclaration:has(StringLiteral[value="@edanalytics/models"])
          NamedImports`,
      (node) => {
        return node
          .getText()
          .replace(/,?\s*?\}$/, `, ${resourceNames.className}}`);
      }
    );

    populate = populate.replace(
      'console.log(colors.green(\'\\nDone.\'));',
      `
    await dataSource.getRepository(${resourceNames.className}).save(generateFake(${resourceNames.className}, () => ({
      createdBy: faker.helpers.arrayElement(users),
    }), 25));

    console.log(colors.green(\'\\nDone.\'));`
    );
    tree.write(populatePath, populate);
    console.warn(
      'You might want to run the demo-populate script to refresh the data to include the new resource.'
    );
  }

  await formatFiles(tree);
}
