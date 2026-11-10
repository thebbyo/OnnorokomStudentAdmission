import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <p>This address doesn&rsquo;t match any page in the admission portal.</p>
      <Link className="btn btn-primary" to="/">
        Go to the class list
      </Link>
    </div>
  );
}
